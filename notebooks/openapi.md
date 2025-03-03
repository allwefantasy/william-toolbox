# 工具箱开放API

William Toolbox提供了一系列开放API，允许第三方应用程序访问工具箱中的模型和RAG服务。本文档详细介绍了如何获取和使用API Key，以及可用的API端点。

## 获取 API Key

在工具箱中，用户可以管理模型和RAG，我们对外提供了API可以让第三方应用访问工具箱的API获取模型和RAG服务的信息。在访问这些API之前，你需要先获取API Key。

### 通过管理界面获取API Key

1. 使用管理员账号登录William Toolbox
2. 导航到"API Key管理"页面
3. 点击"创建API Key"按钮
4. 填写以下信息：
   - 名称：为你的API Key指定一个有意义的名称
   - 描述（可选）：添加描述以便于识别API Key的用途
   - 有效期：设置API Key的有效期（天数），或选择"永不过期"
5. 点击"确定"创建API Key


### 通过API创建API Key（需要管理员权限）

如果你需要通过程序创建API Key，可以使用以下步骤：

1. 首先获取JWT Token：

```python
import requests

BASE_URL = "http://your-william-toolbox-url:port"
login_url = f"{BASE_URL}/auth/login"
login_data = {
    "username": "admin",  # 替换为你的管理员用户名
    "password": "your_password"  # 替换为你的管理员密码
}

login_response = requests.post(login_url, json=login_data)
token = login_response.json().get('token')
```

2. 使用JWT Token创建API Key：

```python
create_key_url = f"{BASE_URL}/api-keys"
create_key_headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}
create_key_data = {
    "name": "My API Key",
    "description": "Created programmatically",
    "expires_in_days": 30  # 设置为-1表示永不过期
}

create_key_response = requests.post(
    create_key_url, 
    headers=create_key_headers, 
    json=create_key_data
)
api_key_info = create_key_response.json()
print(f"API Key: {api_key_info['key']}")
```

## 使用API Key

获取API Key后，你可以在HTTP请求的Authorization头中使用Bearer认证方式来使用它：

```python
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
```

## 可用的API端点

### 1. 获取OpenAI兼容服务信息

此端点提供有关工具箱中配置的OpenAI兼容服务的信息，包括主机、端口和运行状态。

- **URL**: `/api/public/openai-compatible-service-info`
- **方法**: GET
- **认证**: 不需要认证
- **响应示例**:
```json
{
  "host": "localhost",
  "port": 8000,
  "isRunning": true
}
```

### 2. 获取可用的RAG列表

此端点返回工具箱中所有可用的RAG（检索增强生成）服务列表。

- **URL**: `/api/public/available-rags`
- **方法**: GET
- **认证**: 需要API Key
- **响应示例**:
```json
[
  {
    "id": "rag-1",
    "name": "文档知识库",
    "description": "包含公司文档的知识库",
    "created_at": "2023-05-15T10:30:00",
    "status": "active"
  },
  {
    "id": "rag-2",
    "name": "产品手册",
    "description": "产品使用手册知识库",
    "created_at": "2023-06-20T14:45:00",
    "status": "active"
  }
]
```

### 3. 获取可用的模型列表

此端点返回工具箱中所有可用的模型列表，包括模型名称和运行状态。

- **URL**: `/api/public/available-models`
- **方法**: GET
- **认证**: 需要API Key
- **响应示例**:
```json
[
  {
    "id": "model-1",
    "name": "deepseek_chat",
    "description": "DeepSeek聊天模型",
    "status": "running",
    "created_at": "2023-04-10T09:15:00"
  },
  {
    "id": "model-2",
    "name": "qwen_vl",
    "description": "通义千问视觉语言模型",
    "status": "stopped",
    "created_at": "2023-05-05T11:20:00"
  }
]
```

## 示例代码

以下是使用Python访问这些API的完整示例：

```python
import requests
from pprint import pprint

# 配置
BASE_URL = "http://localhost:8005"  # 根据你的实际部署情况修改
API_KEY = "sk-your-api-key"  # 替换为你的实际API Key

# 设置通用请求头
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 1. 获取OpenAI兼容服务信息（不需要API Key）
def get_openai_service_info():
    url = f"{BASE_URL}/api/public/openai-compatible-service-info"
    response = requests.get(url)
    
    if response.status_code == 200:
        print("✅ 成功获取OpenAI兼容服务信息")
        pprint(response.json())
    else:
        print(f"❌ 请求失败: {response.status_code}")
        print(response.text)
    
    return response.json() if response.status_code == 200 else None

# 2. 获取可用的RAG列表（需要API Key）
def get_available_rags():
    url = f"{BASE_URL}/api/public/available-rags"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        print("✅ 成功获取RAG列表")
        rags = response.json()
        print(f"共有 {len(rags)} 个RAG")
        for rag in rags:
            print(f"- {rag['name']}")
    else:
        print(f"❌ 请求失败: {response.status_code}")
        print(response.text)
    
    return response.json() if response.status_code == 200 else None

# 3. 获取可用的模型列表（需要API Key）
def get_available_models():
    url = f"{BASE_URL}/api/public/available-models"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        print("✅ 成功获取模型列表")
        models = response.json()
        print(f"共有 {len(models)} 个模型")
        for model in models:
            print(f"- {model['name']} (状态: {model['status']})")
    else:
        print(f"❌ 请求失败: {response.status_code}")
        print(response.text)
    
    return response.json() if response.status_code == 200 else None

# 执行测试
openai_service_info = get_openai_service_info()
rags = get_available_rags()
models = get_available_models()
```

## API Key管理

### 列出所有API Key（需要管理员权限）

- **URL**: `/api-keys`
- **方法**: GET
- **认证**: 需要JWT Token（管理员权限）
- **响应示例**:
```json
[
  {
    "key": "sk-1234567890abcdef",
    "name": "测试Key",
    "description": "用于测试的API Key",
    "created_at": "2023-07-01T08:00:00",
    "expires_at": "2023-08-01T08:00:00",
    "is_active": true
  }
]
```

### 撤销API Key（需要管理员权限）

- **URL**: `/api-keys/{key}`
- **方法**: DELETE
- **认证**: 需要JWT Token（管理员权限）
- **响应示例**:
```json
{
  "message": "API key revoked successfully"
}
```

## 注意事项

1. API Key是访问这些API的唯一凭证，请妥善保管，不要泄露给未授权的人员
2. API Key有过期时间，请在过期前更新或创建新的API Key
3. 如果API Key泄露，请立即通过管理界面撤销该API Key
4. 所有API请求都应使用HTTPS以确保数据传输安全