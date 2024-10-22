import os
import json

# Path to the chat.json file
CHAT_JSON_PATH = "chat.json"


# Function to load chat data from JSON file
def load_chat_data():
    if os.path.exists(CHAT_JSON_PATH):
        with open(CHAT_JSON_PATH, "r") as f:
            return json.load(f)
    return {"conversations": []}


# Function to save chat data to JSON file
def save_chat_data(data):
    with open(CHAT_JSON_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# Add this function to load the config
def load_config():
    config_path = "config.json"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return json.load(f)
    return {}

def save_config(config):
    """Save the configuration to file."""
    with open("config.json", "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# Path to the models.json file
MODELS_JSON_PATH = "models.json"
RAGS_JSON_PATH = "rags.json"


# Function to load models from JSON file
def load_models_from_json():
    if os.path.exists(MODELS_JSON_PATH):
        with open(MODELS_JSON_PATH, "r") as f:
            return json.load(f)
    return {}


# Function to save models to JSON file
def save_models_to_json(models):
    with open(MODELS_JSON_PATH, "w") as f:
        json.dump(models, f, indent=2, ensure_ascii=False)


# Function to load RAGs from JSON file
def load_rags_from_json():
    if os.path.exists(RAGS_JSON_PATH):
        with open(RAGS_JSON_PATH, "r") as f:
            return json.load(f)
    return {}


# Function to save RAGs to JSON file
def save_rags_to_json(rags):
    with open(RAGS_JSON_PATH, "w") as f:
        json.dump(rags, f, indent=2, ensure_ascii=False)

def get_event_file_path(request_id: str) -> str:
    os.makedirs("chat_events", exist_ok=True)
    return f"chat_events/{request_id}.json"