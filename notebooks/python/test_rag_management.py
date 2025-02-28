import os
import sys
import time
import asyncio
import psutil
from pathlib import Path
import traceback
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("rag_test")

async def test_rag_management():
    """Test starting and stopping a RAG process"""
    
    # Create a test RAG configuration
    rag_info = {
        "name": "test_rag",
        "model": "v3_chat",
        "doc_dir": "/app/work/rag-1",
        "port": 8100,
        "host": "0.0.0.0",
        "rag_doc_filter_relevance": 2,
        "tokenizer_path": "",
        "required_exts": "",
        "disable_inference_enhance": True,
        "inference_deep_thought": False,
        "without_contexts": False,
        "enable_hybrid_index": False,
        "status": "stopped"
    }
    
    # Step 1: Start the RAG process
    logger.info("=== STARTING RAG PROCESS ===")
    
    try:
        # Setup command
        command = "auto-coder.rag serve"
        command += " --quick"
        command += f" --model {rag_info['model']}"
        
        if rag_info["tokenizer_path"]:
            command += f" --tokenizer_path {rag_info['tokenizer_path']}"
            
        command += f" --doc_dir {rag_info['doc_dir']}"
        command += f" --rag_doc_filter_relevance {rag_info['rag_doc_filter_relevance']}"
        command += f" --host {rag_info['host']}"
        command += f" --port {rag_info['port']}"
        
        if rag_info["disable_inference_enhance"]:
            command += " --disable_inference_enhance"
            
        if rag_info["inference_deep_thought"]:
            command += " --inference_deep_thought"
            
        if rag_info["without_contexts"]:
            command += " --without_contexts"
            
        if "enable_hybrid_index" in rag_info and rag_info["enable_hybrid_index"]:
            command += " --enable_hybrid_index"
            
        logger.info(f"Command: {command}")
        
        # Create logs directory
        os.makedirs("logs", exist_ok=True)
        
        # Open log files
        stdout_log_path = os.path.join("logs", f"{rag_info['name']}.out")
        stderr_log_path = os.path.join("logs", f"{rag_info['name']}.err")
        
        stdout_log = open(stdout_log_path, "w")
        stderr_log = open(stderr_log_path, "w")
        
        # Store file descriptors
        rag_info["stdout_fd"] = stdout_log.fileno()
        rag_info["stderr_fd"] = stderr_log.fileno()
        
        # Start the process
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=stdout_log,
            stderr=stderr_log
        )
        
        # Store process info
        rag_info["process_id"] = process.pid
        rag_info["status"] = "running"
        
        logger.info(f"Process started with PID: {process.pid}")
        
        # Wait some time to ensure the process is running
        logger.info("Waiting 10 seconds for the process to start up...")
        await asyncio.sleep(10)
        
        # Verify the process is running
        try:
            p = psutil.Process(process.pid)
            if p.is_running():
                logger.info(f"✅ Process is running. Status: {p.status()}")
                
                # Print info about process resources
                mem_info = p.memory_info()
                logger.info(f"Memory usage: {mem_info.rss / 1024 / 1024:.2f} MB")
                logger.info(f"CPU percent: {p.cpu_percent(interval=1.0)}")
                
                # Check for any child processes
                children = p.children(recursive=True)
                if children:
                    logger.info(f"Process has {len(children)} child processes")
                    for i, child in enumerate(children):
                        logger.info(f"Child {i+1}: PID={child.pid}, Name={child.name()}")
                else:
                    logger.info("Process has no child processes")
            else:
                logger.error("❌ Process is not running!")
        except psutil.NoSuchProcess:
            logger.error("❌ Process not found! It may have terminated.")
            
        # Step 2: Stop the RAG process
        logger.info("\n=== STOPPING RAG PROCESS ===")
        
        try:
            process_id = rag_info["process_id"]
            # Get process object
            p = psutil.Process(process_id)
            
            # First try graceful termination
            logger.info(f"Sending SIGTERM to process {process_id}")
            p.terminate()
            
            # Wait for process to terminate
            try:
                logger.info("Waiting up to 5 seconds for graceful termination...")
                p.wait(timeout=5)
                logger.info("✅ Process terminated gracefully")
            except psutil.TimeoutExpired:
                # Force kill if needed
                logger.warning("Process didn't terminate gracefully, force killing")
                p.kill()
                logger.info("Process killed forcefully")
                
            # Kill any child processes
            try:
                children = p.children(recursive=True)
                if children:
                    logger.info(f"Killing {len(children)} child processes")
                    for child in children:
                        child.kill()
            except:
                pass
                
            # Close file descriptors
            if 'stdout_fd' in rag_info:
                try:
                    logger.info(f"Closing stdout file descriptor {rag_info['stdout_fd']}")
                    os.close(rag_info['stdout_fd'])
                    del rag_info['stdout_fd']
                    logger.info("✅ Stdout file descriptor closed")
                except OSError as e:
                    logger.error(f"Error closing stdout fd: {e}")
                
            if 'stderr_fd' in rag_info:
                try:
                    logger.info(f"Closing stderr file descriptor {rag_info['stderr_fd']}")
                    os.close(rag_info['stderr_fd'])
                    del rag_info['stderr_fd']
                    logger.info("✅ Stderr file descriptor closed")
                except OSError as e:
                    logger.error(f"Error closing stderr fd: {e}")
                
            # Update status
            rag_info["status"] = "stopped"
            for key in ["process_id", "pgid", "service_id"]:
                if key in rag_info:
                    del rag_info[key]
                    
            logger.info("✅ Process successfully stopped and resources cleaned up")
            
            # Verify process is gone
            try:
                process = psutil.Process(process_id)
                if process.is_running():
                    logger.error("❌ Process is still running despite termination attempt!")
                else:
                    logger.info("✅ Process confirmed to be stopped")
            except psutil.NoSuchProcess:
                logger.info("✅ Process confirmed to be stopped")
            
        except psutil.NoSuchProcess:
            logger.warning(f"Process {rag_info.get('process_id')} already not running")
            # Clean up anyway
            if 'stdout_fd' in rag_info:
                os.close(rag_info['stdout_fd'])
                del rag_info['stdout_fd']
            if 'stderr_fd' in rag_info:
                os.close(rag_info['stderr_fd'])
                del rag_info['stderr_fd']
            rag_info["status"] = "stopped"
            
        except Exception as e:
            logger.error(f"Failed to stop RAG: {str(e)}")
            traceback.print_exc()
            
        # Check log files
        logger.info("\n=== CHECKING LOG FILES ===")
        stdout_size = os.path.getsize(stdout_log_path) if os.path.exists(stdout_log_path) else 0
        stderr_size = os.path.getsize(stderr_log_path) if os.path.exists(stderr_log_path) else 0
        
        logger.info(f"Stdout log size: {stdout_size/1024:.2f} KB")
        logger.info(f"Stderr log size: {stderr_size/1024:.2f} KB")
        
        # Print last few lines of logs if they exist
        if stdout_size > 0:
            logger.info("Last 5 lines of stdout log:")
            with open(stdout_log_path, 'r') as f:
                lines = f.readlines()
                for line in lines[-5:]:
                    logger.info(f"  {line.strip()}")
                    
        if stderr_size > 0:
            logger.info("Last 5 lines of stderr log:")
            with open(stderr_log_path, 'r') as f:
                lines = f.readlines()
                for line in lines[-5:]:
                    logger.info(f"  {line.strip()}")
                    
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        traceback.print_exc()
        
        # Clean up resources in case of failure
        if 'stdout_fd' in rag_info:
            try:
                os.close(rag_info['stdout_fd'])
            except:
                pass
        if 'stderr_fd' in rag_info:
            try:
                os.close(rag_info['stderr_fd'])
            except:
                pass
                
        # Try to kill process if it exists
        if 'process_id' in rag_info:
            try:
                process = psutil.Process(rag_info['process_id'])
                process.kill()
            except:
                pass

if __name__ == "__main__":
    logger.info("Starting RAG management test")
    asyncio.run(test_rag_management())
    logger.info("Test completed") 