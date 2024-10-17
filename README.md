
# William Toolbox 🧰

William Toolbox is an open-source project designed to simplify the management of AI models and RAG (Retrieval-Augmented Generation) systems. It provides a user-friendly interface for deploying, monitoring, and controlling various AI models and RAG setups.

## 🌟 Features

- 🤖 Model Management: Deploy, start, stop, and monitor AI models
- 📚 RAG System Management: Create and control RAG setups
- 🖥️ User-friendly Web Interface: Easy-to-use dashboard for all operations
- 🔄 Real-time Status Updates: Monitor the status of your models and RAGs
- 🛠️ Flexible Configuration: Customize model and RAG parameters

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- Node.js and npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/william-toolbox.git
   cd william-toolbox
   ```

2. Install backend dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

### Running the Application

1. Start the backend server:
   ```
   python src/williamtoolbox/server/backend_server.py
   ```

2. Start the proxy server:
   ```
   python src/williamtoolbox/server/proxy_server.py
   ```

3. Start the frontend development server:
   ```
   cd frontend
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## 📖 Usage

1. **Adding a Model**: Click on "Add Model" and fill in the required information.
2. **Managing Models**: Use the model list to start, stop, or check the status of your models.
3. **Creating a RAG**: Click on "Add RAG" and provide the necessary details.
4. **Managing RAGs**: Control and monitor your RAG systems from the RAG list.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- Thanks to all contributors who have helped shape William Toolbox.
- Special thanks to the open-source community for providing the tools and libraries that make this project possible.
