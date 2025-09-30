// src/App.js

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Settings, X, RotateCcw, User, Save, Folder, Download } from 'lucide-react';
import './App.css';

// Прямой URL API-сервера
const API_URL = 'http://localhost:5001';

function App() {
  const [messages, setMessages] = useState([
    { text: 'Чтобы начать практику, отправь первое сообщение', sender: 'model', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatViewModalOpen, setIsChatViewModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [viewingChat, setViewingChat] = useState(null);
  const [savedChats, setSavedChats] = useState([]);
  const [difficulty, setDifficulty] = useState('Открытый');
  const [difficulties, setDifficulties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState('');

  const [currentDescription, setCurrentDescription] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, viewingChat]);

  useEffect(() => {
    fetchDifficulties();
  }, []);

  useEffect(() => {
    if (difficulties.length > 0) {
      setCurrentDescription(difficulties.find(d => d.id === difficulty));
    }
  }, [difficulty, difficulties]);

  const fetchDifficulties = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/difficulties`);
      const fetchedDifficulties = response.data.difficulties;
      setDifficulties(fetchedDifficulties);
      setCurrentDescription(fetchedDifficulties.find(d => d.id === 'Открытый'));
      setError(null);
    } catch (err) {
      console.error('Ошибка загрузки сложностей:', err);
      setError('Не удалось загрузить сложности с сервера. Используются резервные.');
      const fallbackDifficulties = [
        { id: 'Открытый', name: 'Открытый', description: 'Дружелюбный собеседник', phrases: ['Интересно...', 'А что ты думаешь...', 'Хм, никогда так не думал...'] },
        { id: 'Грубый', name: 'Грубый', description: 'Резкий и саркастичный', phrases: ['Бред какой-то...', 'Да ладно тебе...', 'Серьёзно?!...'] },
        { id: 'Малообщительный', name: 'Малообщительный', description: 'Говорит мало, односложно отвечает', phrases: ['Да', 'Нет', 'Не знаю...'] },
        { id: 'Незаинтересованный', name: 'Незаинтересованный', description: 'Скучный, равнодушный', phrases: ['И что?', 'Скучно...', 'А что по телеку?...'] },
        { id: 'Закрытый', name: 'Закрытый', description: 'Настороженный, боится открыться', phrases: ['Не хочу об этом...', 'Мне это не нужно...', 'Оставь меня в покое...'] },
        { id: 'Энтузиаст', name: 'Энтузиаст', description: 'Очень активный, задаёт много вопросов', phrases: ['Расскажи ещё!', 'А как насчёт...', 'Это так интересно!...'] },
        { id: 'Философ', name: 'Философ', description: 'Любит глубокие разговоры', phrases: ['А что если...', 'Но как же тогда...', 'Это поднимает вопрос о...'] },
        { id: 'Материалист', name: 'Материалист', description: 'Интересуют только практические вопросы', phrases: ['А что мне это даст?', 'Как это поможет заработать?', 'Это практично?...'] }
      ];
      setDifficulties(fallbackDifficulties);
      setCurrentDescription(fallbackDifficulties.find(d => d.id === 'Открытый'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = { text: input, sender: 'user', timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const historyToSend = updatedMessages.map(msg => ({
        role: msg.sender === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

      const response = await axios.post(`${API_URL}/api/chat`, {
        history: historyToSend,
        difficulty: difficulty
      });

      const botMessage = { text: response.data.message, sender: 'model', timestamp: new Date() };
      setMessages(prevMessages => [...prevMessages, botMessage]);
      setError(null);
    } catch (err) {
      console.error('Ошибка при отправке сообщения:', err);
      let errorMessage = 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте снова.';
      if (err.response && err.response.data && err.response.data.error) {
        errorMessage = `Ошибка: ${err.response.data.error}`;
      } else if (axios.isCancel(err)) {
        errorMessage = 'Запрос был отменен.';
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Проблема с соединением. Убедитесь, что сервер запущен.';
      } else if (err.response && err.response.status === 503) {
        errorMessage = 'Сервер перегружен. Пожалуйста, попробуйте через минуту.';
      }
      setError(errorMessage);

      const errorChatBubble = {
        text: '❌ ' + errorMessage,
        sender: 'model',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prevMessages => [...prevMessages, errorChatBubble]);
    } finally {
      setIsTyping(false);
    }
  };
  
  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('ChatArchive', 1);

      request.onerror = (event) => {
        setDbStatus('Ошибка IndexedDB: ' + event.target.errorCode);
        reject('Error opening database');
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore('chats', { keyPath: 'id' });
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    });
  };

  const saveChatToDB = async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['chats'], 'readwrite');
      const objectStore = transaction.objectStore('chats');

      const chatToSave = {
        id: new Date().toISOString(),
        difficulty,
        chatHistory: messages,
      };

      const putRequest = objectStore.put(chatToSave);

      putRequest.onsuccess = () => {
        setDbStatus('Чат успешно сохранен!');
        fetchSavedChats();
      };

      putRequest.onerror = () => {
        setDbStatus('Ошибка при сохранении чата.');
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavedChats = async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['chats'], 'readonly');
      const objectStore = transaction.objectStore('chats');
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const chats = event.target.result;
        setSavedChats(chats.reverse());
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['chats'], 'readwrite');
      const objectStore = transaction.objectStore('chats');
      const request = objectStore.delete(chatId);

      request.onsuccess = () => {
        setDbStatus('Чат успешно удален.');
        fetchSavedChats();
      };

      request.onerror = () => {
        setDbStatus('Ошибка при удалении чата.');
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (err) {
      console.error('Ошибка при удалении чата:', err);
    }
  };

  const handleLoadChatFromFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
        if (parsedData.chatHistory) {
          setViewingChat(parsedData);
          setIsChatViewModalOpen(true);
          setIsArchiveModalOpen(false);
        } else {
          setDbStatus('Ошибка: Файл не содержит историю чата.');
        }
      } catch (err) {
        setDbStatus('Ошибка: Не удалось прочитать JSON-файл.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCurrentChat = () => {
    const chatData = {
      difficulty,
      chatHistory: messages,
      exportTimestamp: new Date().toISOString()
    };
    const jsonString = JSON.stringify(chatData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat_export_${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAllChats = async () => {
    setDbStatus('Экспортирую все чаты... Пожалуйста, подождите.');
    try {
      const db = await openDB();
      const transaction = db.transaction(['chats'], 'readonly');
      const objectStore = transaction.objectStore('chats');
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const allChats = event.target.result;
        const chatData = {
          exportedChats: allChats,
          exportTimestamp: new Date().toISOString()
        };
        const jsonString = JSON.stringify(chatData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat_archive_export_${new Date().toISOString()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDbStatus('Экспорт завершен!');
      };

      transaction.oncomplete = () => {
        db.close();
      };
    } catch (err) {
      setDbStatus('Ошибка экспорта.');
      console.error('Ошибка при экспорте всех чатов:', err);
    }
  };

  const handleViewSavedChat = (chat) => {
    setViewingChat(chat);
    setIsChatViewModalOpen(true);
    setIsArchiveModalOpen(false);
  };

  const handleEditChat = () => {
    if (viewingChat && viewingChat.chatHistory) {
      setMessages(viewingChat.chatHistory);
      setDifficulty(viewingChat.difficulty);
      setIsChatViewModalOpen(false);
      setViewingChat(null);
    }
  };

  const handleNewChat = async () => {
    try {
      await axios.post(`${API_URL}/api/reset`);
      setMessages([{
        text: 'Привет! Я Алекс. Готов к новому разговору 🙂',
        sender: 'model',
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error('Ошибка при сбросе:', err);
      setError('Не удалось сбросить диалог.');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };
  
  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="user-info">
            <div className="avatar">Ф</div>
            <div className="user-details">
              <h1>Фома</h1>
              <span className="status">{isTyping ? 'Печатает...' : 'Онлайн'}</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={saveChatToDB} title="Сохранить чат">
              <Save size={20} />
            </button>
            <button className="icon-button" onClick={() => { setIsArchiveModalOpen(true); fetchSavedChats(); }} title="Архив чатов">
              <Folder size={20} />
            </button>
            <button className="icon-button" onClick={handleExportCurrentChat} title="Скачать чат">
              <Download size={20} />
            </button>
            <button className="icon-button" onClick={() => setIsSettingsModalOpen(true)} title="Настройки">
              <Settings size={20} />
            </button>
            <button className="icon-button" onClick={handleNewChat} title="Новый диалог">
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </header>
      <main className="chat-container">
        {error && <div className="error-message">Error: {error}</div>}
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message-container ${msg.sender}`}>
              <div className={`message ${msg.sender}`}>
                <div className={`bubble ${msg.isError ? 'error' : ''} ${isTyping && msg.sender === 'model' && index === messages.length - 1 ? 'typing' : ''}`}>
                  <div className="message-text">
                    {msg.sender === 'model' && isTyping && index === messages.length - 1 ? (
                       <div className="typing-indicator">
                         <span></span>
                         <span></span>
                         <span></span>
                       </div>
                    ) : (
                      msg.text.split('\n').map((line, lineIndex) => (
                        <React.Fragment key={lineIndex}>
                          {line}
                          {lineIndex < msg.text.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))
                    )}
                  </div>
                </div>
                <div className="timestamp">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form className="input-container" onSubmit={handleSendMessage}>
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="message-input"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Введите сообщение..."
              disabled={isTyping}
              rows="1"
            />
            <button type="submit" className="send-button" disabled={isTyping || !input.trim()}>
              <Send size={20} />
            </button>
          </div>
        </form>
      </main>

      {isSettingsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Настройки сложности</h3>
              <button className="close-button" onClick={() => setIsSettingsModalOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-content">
              {isLoading ? (
                <div className="loading-state">
                  <p>Загрузка профилей...</p>
                </div>
              ) : (
                <div className="setting-group">
                  <label htmlFor="difficulty-select">Сложность:</label>
                  <select
                    id="difficulty-select"
                    className="difficulty-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {difficulties.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {currentDescription && (
                    <div className="difficulty-description">
                      <h4>{currentDescription.name}</h4>
                      <p>{currentDescription.description}</p>
                      {currentDescription.phrases && (
                        <div className="example-phrases">
                          <strong>Примеры фраз:</strong>
                          <div className="phrases">
                            {currentDescription.phrases.map((phrase, idx) => (
                              <span key={idx} className="phrase-tag">"{phrase}"</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <footer className="modal-footer">
              <button className="save-button" onClick={() => setIsSettingsModalOpen(false)}>
                Применить
              </button>
            </footer>
          </div>
        </div>
      )}
      
      {isArchiveModalOpen && (
        <div className="modal-overlay" onClick={() => setIsArchiveModalOpen(false)}>
          <div className="modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Архив чатов</h3>
              <button className="close-button" onClick={() => setIsArchiveModalOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-content">
              <div className="archive-controls">
                <button className="save-button" onClick={saveChatToDB}>
                  Сохранить текущий чат
                </button>
                <label className="button-upload save-button">
                  Загрузить из файла
                  <input type="file" accept=".json" onChange={handleLoadChatFromFile} style={{ display: 'none' }} />
                </label>
              </div>
              {dbStatus && <div className="db-status-message">{dbStatus}</div>}
              {savedChats.length > 0 ? (
                <div className="chat-grid">
                  {savedChats.map(chat => (
                    <div key={chat.id} className="chat-grid-item">
                      <div className="chat-info">
                        <strong>{new Date(chat.id).toLocaleString()}</strong>
                        <small>Профиль: {chat.difficulty}</small>
                      </div>
                      <div className="chat-actions">
                        <button className="view-button" onClick={() => handleViewSavedChat(chat)}>
                          Просмотреть
                        </button>
                        <button className="delete-button" onClick={() => handleDeleteChat(chat.id)}>
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>В архиве пока нет сохраненных чатов.</p>
              )}
            </div>
            <footer className="modal-footer">
              <button className="save-button" onClick={() => setIsArchiveModalOpen(false)}>
                Закрыть
              </button>
            </footer>
          </div>
        </div>
      )}

      {isChatViewModalOpen && viewingChat && (
        <div className="modal-overlay" onClick={() => setIsChatViewModalOpen(false)}>
          <div className="modal chat-view-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Просмотр чата</h3>
              <button className="close-button" onClick={() => { setIsChatViewModalOpen(false); setViewingChat(null); }}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-content chat-view-content">
              <div className="messages view-messages">
                {viewingChat.chatHistory.map((msg, index) => (
                  <div key={index} className={`message-container ${msg.sender}`}>
                    <div className={`message ${msg.sender}`}>
                      <div className="bubble">
                        <div className="message-text">{msg.text.split('\n').map((line, lineIndex) => (
                           <React.Fragment key={lineIndex}>
                             {line}
                             {lineIndex < msg.text.split('\n').length - 1 && <br />}
                           </React.Fragment>
                         ))}</div>
                      </div>
                      <div className="timestamp">{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="save-button primary-button" onClick={handleEditChat}>
                Продолжить этот чат
              </button>
              <button className="save-button secondary-button" onClick={() => { setIsChatViewModalOpen(false); setViewingChat(null); }}>
                Закрыть
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;