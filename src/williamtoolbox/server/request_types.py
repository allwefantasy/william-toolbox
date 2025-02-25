from typing import Optional, Any, List, Dict
from pydantic import BaseModel, Field

class OpenAIServiceStartRequest(BaseModel):
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)


class Message(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str
    thoughts: List[str] = []


class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[Message]


class ChatData(BaseModel):
    conversations: List[Conversation]


class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[Message]


class ChatData(BaseModel):
    conversations: List[Conversation]


class AddMessageRequest(BaseModel):
    messages: List[Message]  # Change to accept full message history
    list_type: str
    selected_item: str

class ProductType(str, Enum):
    pro = "pro"
    lite = "lite"

class AddModelRequest(BaseModel):
    name: str
    pretrained_model_type: str
    cpus_per_worker: float = Field(default=0.001)
    gpus_per_worker: int = Field(default=0)
    num_workers: int = Field(default=1)
    worker_concurrency: Optional[int] = Field(default=None)
    infer_params: dict = Field(default_factory=dict)
    model_path: Optional[str] = Field(default=None)
    infer_backend: Optional[str] = Field(default=None)
    product_type: ProductType = Field(default=ProductType.lite)
    is_reasoning: Optional[bool] = Field(default=None)
    input_price: Optional[float] = Field(default=None)
    output_price: Optional[float] = Field(default=None)


class AddRAGRequest(BaseModel):
    name: str
    model: str
    tokenizer_path: str
    doc_dir: str
    rag_doc_filter_relevance: float = Field(default=2.0)
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    required_exts: str = Field(default="")
    disable_inference_enhance: bool = Field(default=False)
    inference_deep_thought: bool = Field(default=False)
    enable_hybrid_index: bool = Field(default=False)
    hybrid_index_max_output_tokens: int = Field(default=1000000)
    without_contexts: bool = Field(default=False)
    infer_params: Optional[Dict[str, Any]] = Field(default_factory=dict)
    model_config = {"protected_namespaces": ()}  


class DeployCommand(BaseModel):
    pretrained_model_type: str
    cpus_per_worker: float = Field(default=0.001)
    gpus_per_worker: int = Field(default=0)
    num_workers: int = Field(default=1)
    worker_concurrency: Optional[int] = Field(default=None)
    infer_params: dict = Field(default_factory=dict)
    model: str
    model_path: Optional[str] = Field(default=None)
    infer_backend: Optional[str] = Field(default=None)
    model_config = {"protected_namespaces": ()}


class AddMessageResponse(BaseModel):
    request_id: str
    response_message_id: str

class EventResponse(BaseModel):
    events: list[Dict[str, Any]]

class ModelInfo(BaseModel):
    name: str
    status: str

class CreateConversationRequest(BaseModel):
    title: str

class UpdateTitleRequest(BaseModel):
    title: str

class AddSuperAnalysisRequest(BaseModel):
    name: str
    served_model_name: str
    port: int = Field(default=8000)
    schema_rag_base_url: str
    context_rag_base_url: str
    byzer_sql_url: str = Field(default="http://127.0.0.1:9003/run/script")
    host: str = Field(default="0.0.0.0")
class RunSQLRequest(BaseModel):
    sql: str
    engine_url: str
    owner: str

class AddByzerSQLRequest(BaseModel):
    name: str
    install_dir: str
    host: str
    port: int

