// import React, { useState, useRef, useEffect, useMemo } from 'react';
// import axios from 'axios';
// import { Layout, Upload, Button, Typography, List, Avatar, Empty, Spin, Modal, message, Select } from 'antd';
// import {
//   UploadOutlined,
//   FileTextOutlined,
//   MessageOutlined,
//   RobotOutlined,
//   DeleteOutlined,
//   DatabaseOutlined,
//   RocketOutlined
// } from '@ant-design/icons';
// import mammoth from 'mammoth';
// import ReactQuill from 'react-quill';
// import 'react-quill/dist/quill.snow.css';
// import { Viewer, Worker } from '@react-pdf-viewer/core';
// import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
// import '@react-pdf-viewer/core/lib/styles/index.css';
// import '@react-pdf-viewer/default-layout/lib/styles/index.css';
// import './styles.css';

// interface Comment {  
//   text: string;
//   comment: string;  
// }

// // 添加高亮文本的样式
// const highlightedTextStyle = `
//   .highlighted-text {
//     background-color: #fff3cd;
//     padding: 2px;
//     border-radius: 4px;
//     cursor: pointer;
//     transition: background-color 0.3s;
//   }
//   .highlighted-text:hover {
//     background-color: #ffe69c;
//   }
// `;

// // 动态插入样式
// const styleSheet = document.createElement("style");
// styleSheet.type = "text/css";
// styleSheet.innerText = highlightedTextStyle;
// document.head.appendChild(styleSheet);

// const { Sider, Content } = Layout;
// const { Title, Text } = Typography;

// interface Annotation {
//   id: string;
//   text: string;
//   comment: string;
//   timestamp: string;
//   aiAnalysis?: string;
// }

// const Annotation: React.FC = () => {
//   const [documentContent, setDocumentContent] = useState<string>('');
//   const [ragList, setRagList] = useState<string[]>([]);
//   const [selectedRAG, setSelectedRAG] = useState<string>('');
//   const [modelList, setModelList] = useState<string[]>([]);
//   const [selectedModel, setSelectedModel] = useState<string>('');
//   const [fileUuid, setFileUuid] = useState<string>('');

//   // 获取 RAG 和模型列表
//   const fetchLists = async () => {
//     try {
//       const username = sessionStorage.getItem('username') || '';
//       // 获取用户权限
//       const userResponse = await axios.get(`/api/users/${username}`);

//       // 获取 RAG 权限
//       const ragPermissions = userResponse.data.rag_permissions || [];
//       const ragResponse = await axios.get('/rags');
//       const runningRags = ragResponse.data
//         .filter((rag: any) => rag.status === 'running' &&
//           (ragPermissions.includes('*') || ragPermissions.includes(rag.name)))
//         .map((rag: any) => rag.name);
//       setRagList(runningRags);
//       if (runningRags.length > 0) {
//         setSelectedRAG(runningRags[0]);
//       }

//       // 获取模型权限
//       const modelPermissions = userResponse.data.model_permissions || [];
//       const modelResponse = await axios.get('/models');
//       const runningModels = modelResponse.data
//         .filter((model: any) => model.status === 'running' &&
//           (modelPermissions.includes('*') || modelPermissions.includes(model.name)))
//         .map((model: any) => model.name);
//       setModelList(runningModels);
//       if (runningModels.length > 0) {
//         setSelectedModel(runningModels[0]);
//       }
//     } catch (error) {
//       console.error('Error fetching lists:', error);
//     }
//   };

//   useEffect(() => {
//     fetchLists();
//   }, []);

//   // 用于安全渲染 HTML 的 sanitizer
//   const sanitizeHTML = useMemo(() => {
//     const div = document.createElement('div');
//     return (html: string) => {
//       div.innerHTML = html;
//       return div.innerHTML;
//     };
//   }, []);

//   // 用于查找文本在文档中的第一次出现位置并高亮
//   const highlightText = (text: string, annotationId: string, content: string): string => {
//     // 转义特殊字符，避免正则表达式匹配出错
//     const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     const regex = new RegExp(escapedText, 'g');
//     let isFirstMatch = true;
    
//     return content.replace(regex, (match) => {
//       if (isFirstMatch) {
//         isFirstMatch = false;
//         return `<span 
//           id="annotation-${annotationId}"
//           data-annotation-id="${annotationId}" 
//           class="highlighted-text"
//         >${match}</span>`;
//       }
//       return match;
//     });
//   };

//   const [documentType, setDocumentType] = useState<'docx' | 'pdf' | null>(null);
//   const [annotations, setAnnotations] = useState<Annotation[]>([]);
//   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
//   const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
//   const [selectedText, setSelectedText] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [pdfUrl, setPdfUrl] = useState<string>('');
//   const quillRef = useRef<ReactQuill>(null);
//   const defaultLayoutPluginInstance = defaultLayoutPlugin();

//   const handleFileUpload = async (file: File) => {
//     setLoading(true);
//     try {
//       const username = sessionStorage.getItem('username') || '';
//       const formData = new FormData();
//       formData.append('file', file);

//       // 上传文件
//       const uploadResponse = await axios.post('/api/annotations/upload', formData, {
//         headers: {
//           'Content-Type': 'multipart/form-data'
//         },
//         params: {
//           username
//         }
//       });

//       const fileUuid = uploadResponse.data.uuid;
//       setFileUuid(fileUuid);

//       // 获取文档内容
//       const [contentResponse, infoResponse] = await Promise.all([
//         axios.get(`/api/annotations/document/${fileUuid}`),
//         axios.get(`/api/annotations/document/${fileUuid}/info`)
//       ]);

//       // 对 HTML 内容进行安全处理
//       const full_text = sanitizeHTML(contentResponse.data.full_text);
//       const comments: Comment[] = [] //contentResponse.data.comments;
//       const fileInfo = infoResponse.data;

//       if (fileInfo.original_name.endsWith('.pdf')) {
//         setDocumentType('pdf');
//         setPdfUrl(`/data/upload/${fileUuid}`);
//       } else {
//         setDocumentType('docx');
//         setDocumentContent(full_text);
//         // 将注释转换为 annotations 状态
//         const formattedAnnotations = comments.map((comment: any) => ({
//           id: comment.id,
//           text: comment.text,
//           comment: comment.comment,
//           timestamp: comment.timestamp,
//           aiAnalysis: comment.aiAnalysis
//         }));
//         setAnnotations(formattedAnnotations);
//       }

//       return false;
//     } catch (error) {
//       message.error('文件上传或处理失败');
//       console.error(error);
//       return false;
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleTextSelection = () => {
//     const selection = window.getSelection();
//     if (selection && !selection.isCollapsed) {
//       const selectedText = selection.toString();
//       setSelectedText(selectedText);

//       Modal.confirm({
//         title: '添加批注',
//         content: (
//           <ReactQuill
//             theme="snow"
//             placeholder="请输入批注内容..."
//             modules={{
//               toolbar: [
//                 ['bold', 'italic', 'underline'],
//                 ['link'],
//                 [{ list: 'ordered' }, { list: 'bullet' }],
//               ],
//             }}
//             onChange={(value) => {
//               // 更新批注内容
//               const newAnnotation: Annotation = {
//                 id: Date.now().toString(),
//                 text: selectedText,
//                 comment: value,
//                 timestamp: new Date().toISOString(),
//               };
//               setAnnotations(prev => [...prev, newAnnotation]);

//               // 保存批注到后端
//               const username = sessionStorage.getItem('username') || '';
//               axios.post('/api/annotations/save', {
//                 annotation: newAnnotation,
//                 username
//               }, {
//                 headers: {
//                   'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
//                 }
//               }).catch(error => {
//                 console.error('保存批注失败:', error);
//                 message.error('保存批注失败');
//               });
//             }}
//           />
//         ),
//         onOk: () => {
//           message.success('批注已添加');
//         },
//       });
//     }
//   };

//   const handleDeleteAnnotation = (id: string) => {
//     setAnnotations(annotations.filter(anno => anno.id !== id));
//   };

//   const handleAutoGenerateAnnotations = async () => {
//     try {
//       setLoading(true);
//       const response = await axios.post(`/api/annotations/auto_generate`, {
//         file_uuid: fileUuid,
//         rag_name: selectedRAG,
//         model_name: selectedModel
//       });
      
//       // 处理新的批注
//       let updatedContent = documentContent;
//       const newAnnotations = response.data.annotations.map((anno: any) => {
//         const newAnnotation = {
//           ...anno,
//           id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
//           timestamp: new Date().toISOString()
//         };
//         // 为每个新批注在文档中添加高亮
//         updatedContent = highlightText(newAnnotation.text, newAnnotation.id, updatedContent);
//         return newAnnotation;
//       });

//       setDocumentContent(updatedContent);
//       setAnnotations([...annotations, ...newAnnotations]);
//       message.success('自动批注生成成功');
//     } catch (error) {
//       console.error('生成批注失败:', error);
//       message.error('生成批注失败');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <Layout className="annotation-container">
//       <Content className="document-container">
//         <div className="document-header">
//           <Title level={4}>文档查看器</Title>
//           <div style={{ display: 'flex', gap: 8 }}>
//             <Select
//               style={{ width: 200 }}
//               value={selectedRAG}
//               onChange={(value: string) => setSelectedRAG(value)}
//               options={ragList.map((rag) => ({
//                 label: rag,
//                 value: rag
//               }))}
//               placeholder="选择 RAG"
//               suffixIcon={<DatabaseOutlined />}
//             />
//             <Select
//               style={{ width: 200 }}
//               value={selectedModel}
//               onChange={(value: string) => setSelectedModel(value)}
//               options={modelList.map((model) => ({
//                 label: model,
//                 value: model
//               }))}
//               placeholder="选择模型"
//               suffixIcon={<RocketOutlined />}
//             />
//             <Upload
//               accept=".docx,.pdf"
//               showUploadList={false}
//               beforeUpload={handleFileUpload}
//             >
//               <Button icon={<UploadOutlined />}>上传文档</Button>
//             </Upload>
//             <Button
//               icon={<RobotOutlined />}
//               onClick={handleAutoGenerateAnnotations}
//               disabled={!fileUuid || loading}
//             >
//               自动生成批注
//             </Button>
//           </div>
//         </div>
//         {loading ? (
//           <div className="loading-container">
//             <Spin size="large" />
//           </div>
//         ) : documentType === 'pdf' ? (
//           <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
//             <Viewer
//               fileUrl={pdfUrl}
//               plugins={[defaultLayoutPluginInstance]}
//             />
//           </Worker>
//         ) : (
//           <div
//             className="document-content"
//             onMouseUp={handleTextSelection}
//             style={{ whiteSpace: 'pre-wrap' }}
//             onClick={(e) => {
//               const target = e.target as HTMLElement;
//               if (target.classList.contains('highlighted-text')) {
//                 const annotationId = target.getAttribute('data-annotation-id');
//                 if (annotationId) {
//                   const commentItem = document.getElementById(`comment-${annotationId}`);
//                   if (commentItem) {
//                     commentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
//                     commentItem.style.backgroundColor = '#f0f0f0';
//                     setTimeout(() => {
//                       commentItem.style.backgroundColor = 'transparent';
//                     }, 1000);
//                   }
//                 }
//               }
//             }}
//             dangerouslySetInnerHTML={{
//               __html: documentContent
//             }}
//           />
//         )}
//       </Content>
//       <Sider width={400} className="annotation-sider">
//         <div className="annotation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//           <Title level={4}>批注列表</Title>
//           {hasUnsavedChanges && fileUuid && (
//             <Button
//               type="primary"
//               onClick={async () => {
//                 try {
//                   await axios.post(
//                     `/api/annotations/save_all?file_uuid=${fileUuid}`,
//                     annotations
//                   );
//                   message.success('批注已保存');
//                   setHasUnsavedChanges(false);
//                 } catch (error) {
//                   message.error('保存批注失败');
//                   console.error('Error saving annotations:', error);
//                 }
//               }}
//             >
//               保存评注
//             </Button>
//           )}
//         </div>
//         {annotations.length === 0 ? (
//           <Empty description="暂无批注" />
//         ) : (
//           <List
//             className="annotation-list"
//             itemLayout="vertical"
//             dataSource={annotations}
//             renderItem={item => (
//               <List.Item
//                 id={`comment-${item.id}`}
//                 actions={[
//                   <Button
//                     type="text"
//                     danger
//                     icon={<DeleteOutlined />}
//                     onClick={() => handleDeleteAnnotation(item.id)}
//                   >
//                     删除
//                   </Button>
//                 ]}
//                 style={{ cursor: 'pointer' }}
//                 onMouseEnter={() => {
//                   const highlightedElement = document.getElementById(`annotation-${item.id}`);
//                   if (highlightedElement) {
//                     highlightedElement.style.backgroundColor = '#ffe69c';
//                   }
//                 }}
//                 onMouseLeave={() => {
//                   const highlightedElement = document.getElementById(`annotation-${item.id}`);
//                   if (highlightedElement) {
//                     highlightedElement.style.backgroundColor = '#fff3cd';
//                   }
//                 }}
//                 onClick={() => {
//                   const highlightedElement = document.getElementById(`annotation-${item.id}`);
//                   if (highlightedElement) {
//                     // 确保突出显示的元素在视口中可见
//                     const rect = highlightedElement.getBoundingClientRect();
//                     const isInViewport = (
//                       rect.top >= 0 &&
//                       rect.left >= 0 &&
//                       rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
//                       rect.right <= (window.innerWidth || document.documentElement.clientWidth)
//                     );

//                     if (!isInViewport) {
//                       highlightedElement.scrollIntoView({
//                         behavior: 'smooth',
//                         block: 'center'
//                       });
//                     }

//                     // 添加突出显示效果
//                     highlightedElement.style.backgroundColor = '#ffd700';
//                     setTimeout(() => {
//                       highlightedElement.style.backgroundColor = '#fff3cd';
//                     }, 1000);
//                   }
//                 }}
//               >
//                 <List.Item.Meta
//                   avatar={<Avatar icon={<MessageOutlined />} />}
//                   title={<Text ellipsis>{item.text}</Text>}
//                   description={new Date(item.timestamp).toLocaleString()}
//                 />
//                 <div
//                   className="annotation-content"
//                 >
//                   <div
//                     dangerouslySetInnerHTML={{ __html: item.comment }}
//                     style={{ minHeight: '100px', padding: '12px', cursor: 'pointer' }}
//                     onClick={() => {
//                       Modal.confirm({
//                         title: '编辑批注',
//                         content: (
//                           <ReactQuill
//                             value={item.comment}
//                             theme="snow"
//                             onChange={(value) => {
//                               const updatedAnnotations = annotations.map(anno => {
//                                 if (anno.id === item.id) {
//                                   return { ...anno, comment: anno.comment };
//                                 }
//                                 return anno;
//                               });
//                               setAnnotations(updatedAnnotations);
//                               setHasUnsavedChanges(true);
//                             }}
//                             modules={{
//                               toolbar: [
//                                 ['bold', 'italic', 'underline'],
//                                 ['link'],
//                                 [{ list: 'ordered' }, { list: 'bullet' }],
//                                 ['clean'],
//                                 [{ header: [1, 2, 3, false] }],
//                                 ['blockquote', 'code-block'],
//                                 [{ 'color': [] }, { 'background': [] }],
//                               ],
//                             }}
//                             placeholder="请输入批注内容..."
//                             style={{ minHeight: '200px' }}
//                           />
//                         ),
//                         width: 800,
//                         okText: '保存',
//                         cancelText: '取消',
//                         onOk: () => {
//                           message.success('批注已更新');
//                         }
//                       });
//                     }}
//                   />
//                 </div>
//                 {item.aiAnalysis && (
//                   <div className="ai-analysis">
//                     <Avatar icon={<RobotOutlined />} />
//                     <Text type="secondary">{item.aiAnalysis}</Text>
//                   </div>
//                 )}
//               </List.Item>
//             )}
//           />
//         )}
//       </Sider>
//     </Layout>
//   );
// };

// export default Annotation;

const Annotation: React.FC = () => {
  return <div>Annotation</div>;
};

export default Annotation;
