from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
from .request_types import *
from ..storage.json_file import load_models_from_json, save_models_to_json
from loguru import logger

router = APIRouter()

@router.get("/models/{model_name}")
async def get_model(model_name: str):
    """Get detailed information for a specific model."""
    models = await load_models_from_json()
    
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
        
    return models[model_name]


@router.put("/models/{model_name}")
async def update_model(model_name: str, request: AddModelRequest):
    """Update an existing model."""
    models = await load_models_from_json()
    
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
        
    model_info = models[model_name]
    if model_info['status'] == 'running':
        raise HTTPException(
            status_code=400, 
            detail="Cannot update a running model. Please stop it first."
        )
    
    # Update the model's deploy command
    model_info['deploy_command'] = DeployCommand(
        pretrained_model_type=request.pretrained_model_type,
        cpus_per_worker=request.cpus_per_worker,
        gpus_per_worker=request.gpus_per_worker,
        num_workers=request.num_workers,
        worker_concurrency=request.worker_concurrency,
        infer_params=request.infer_params,
        model=model_name,
        model_path=request.model_path,
        infer_backend=request.infer_backend,
    ).model_dump()
    
    models[model_name] = model_info
    await save_models_to_json(models)
    
    return {"message": f"Model {model_name} updated successfully"}