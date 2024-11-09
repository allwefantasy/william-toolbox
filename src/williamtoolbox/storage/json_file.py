import os
import json
import aiofiles


# Path to the models.json file
MODELS_JSON_PATH = "models.json"
RAGS_JSON_PATH = "rags.json"
SUPER_ANALYSIS_JSON_PATH = "super_analysis.json"

# Path to the chat.json file
CHAT_JSON_PATH = "chat.json"


# Function to load chat data from JSON file
async def load_chat_data():
    if os.path.exists(CHAT_JSON_PATH):
        async with aiofiles.open(CHAT_JSON_PATH, "r") as f:
            content = await f.read()
            return json.loads(content)
    return {"conversations": []}


# Function to save chat data to JSON file
async def save_chat_data(data):
    async with aiofiles.open(CHAT_JSON_PATH, "w") as f:
        content = json.dumps(data, ensure_ascii=False)
        await f.write(content)


# Add this function to load the config
async def load_config():
    config_path = "config.json"
    if os.path.exists(config_path):
        async with aiofiles.open(config_path, "r") as f:
            content = await f.read()
            v = json.loads(content)
            if "saasBaseUrls" not in v:
                v["saasBaseUrls"] = []
            if "pretrainedModelTypes" not in v:
                v["pretrainedModelTypes"] = []
            if "commons" not in v:
                v["commons"] = []
            return v
    return {"saasBaseUrls": [], "pretrainedModelTypes": [], "commons": []}


async def save_config(config):
    """Save the configuration to file."""
    async with aiofiles.open("config.json", "w") as f:
        content = json.dumps(config, ensure_ascii=False)
        await f.write(content)


# Path to the models.json file
MODELS_JSON_PATH = "models.json"
RAGS_JSON_PATH = "rags.json"


# Function to load models from JSON file
async def load_models_from_json():
    if os.path.exists(MODELS_JSON_PATH):
        async with aiofiles.open(MODELS_JSON_PATH, "r") as f:
            content = await f.read()
            return json.loads(content)
    return {}


# Function to save models to JSON file
async def save_models_to_json(models):
    async with aiofiles.open(MODELS_JSON_PATH, "w") as f:
        content = json.dumps(models, ensure_ascii=False)
        await f.write(content)


def b_load_models_from_json():
    if os.path.exists(MODELS_JSON_PATH):
        with open(MODELS_JSON_PATH, "r") as f:
            content = f.read()
            return json.loads(content)
    return {}


def b_save_models_to_json(models):
    with open(MODELS_JSON_PATH, "w") as f:
        content = json.dumps(models, ensure_ascii=False)
        f.write(content)


# Function to load RAGs from JSON file
async def load_rags_from_json():
    if os.path.exists(RAGS_JSON_PATH):
        async with aiofiles.open(RAGS_JSON_PATH, "r") as f:
            content = await f.read()
            return json.loads(content)
    return {}


# Function to save RAGs to JSON file
async def save_rags_to_json(rags):
    async with aiofiles.open(RAGS_JSON_PATH, "w") as f:
        content = json.dumps(rags, ensure_ascii=False)
        await f.write(content)

# Function to load Super Analysis from JSON file
async def load_super_analysis_from_json():
    if os.path.exists(SUPER_ANALYSIS_JSON_PATH):
        async with aiofiles.open(SUPER_ANALYSIS_JSON_PATH, "r") as f:
            content = await f.read()
            return json.loads(content)
    return {}

# Function to save Super Analysis to JSON file
async def save_super_analysis_to_json(analyses):
    async with aiofiles.open(SUPER_ANALYSIS_JSON_PATH, "w") as f:
        content = json.dumps(analyses, ensure_ascii=False)
        await f.write(content)

async def get_event_file_path(request_id: str) -> str:
    os.makedirs("chat_events", exist_ok=True)
    return f"chat_events/{request_id}.json"


async def load_byzer_sql_from_json():
    if os.path.exists("byzer_sql.json"):
        async with aiofiles.open("byzer_sql.json", "r") as f:
            content = await f.read()
            return json.loads(content)  
    return {}     

async def save_byzer_sql_to_json(services) -> None:
    async with aiofiles.open("byzer_sql.json", "w") as f:
        content = json.dumps(services, ensure_ascii=False)
        await f.write(content)
