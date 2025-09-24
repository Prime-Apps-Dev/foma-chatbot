// src/App.js

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

// Получаем базовый URL API из переменной окружения
const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const [messages, setMessages] = useState([
    { text: 'Привет! Я твой AI-помощник. Чем могу помочь?', sender: 'model', timestamp: new Date().toLocaleTimeString() },
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
      // ИСПРАВЛЕНО: используем полный URL
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

    const userMessage = { text: input, sender: 'user', timestamp: new Date().toLocaleTimeString() };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      // ИСПРАВЛЕНО: используем полный URL
      const response = await axios.post(`${API_URL}/api/chat`, {
        history: updatedMessages,
        difficulty: difficulty
      });

      const botMessage = { text: response.data.message, sender: 'model', timestamp: new Date().toLocaleTimeString() };
      setMessages(prevMessages => [...prevMessages, botMessage]);
      setError(null);
    } catch (err) {
      console.error('Ошибка при отправке сообщения:', err);
      let errorMessage = 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте снова.';
      if (err.response && err.response.data && err.response.data.error) {
        errorMessage = `Ошибка: ${err.response.data.error}`;
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Проблема с соединением. Убедитесь, что сервер запущен.';
      } else if (err.response && err.response.status === 503) {
        errorMessage = 'Сервер перегружен. Пожалуйста, попробуйте через минуту.';
      }
      setError(errorMessage);

      const errorChatBubble = {
        text: '❌ ' + errorMessage,
        sender: 'model',
        timestamp: new Date().toLocaleTimeString(),
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
          setViewingChat(parsedData.chatHistory);
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
      // Возможно, также стоит удалить этот чат из архива, если вы хотите его "перезаписать"
      // handleDeleteChat(viewingChat.id); 
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
              <span className="status">Онлайн</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={saveChatToDB}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
            </button>
            <button className="icon-button" onClick={handleExportCurrentChat}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button className="icon-button" onClick={() => { setIsArchiveModalOpen(true); fetchSavedChats(); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <button className="icon-button" onClick={() => setIsSettingsModalOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 6.2 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.82-1c.24-.45.4-.9.56-1.35.16-.45.32-.9.5-1.35.18-.45.36-.88.54-1.3.18-.42.36-.82.54-1.2.18-.4.36-.78.54-1.16.18-.38.36-.74.54-1.08.18-.34.36-.66.54-1a1.65 1.65 0 0 0 1.51-1V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.82 1.65z"></path>
              </svg>
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
                      msg.text
                    )}
                  </div>
                </div>
                <div className="timestamp">{msg.timestamp}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form className="input-container" onSubmit={handleSendMessage}>
          <div className="input-wrapper">
            <input
              type="text"
              className="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Введите сообщение..."
              disabled={isTyping}
            />
            <button type="submit" className="send-button" disabled={isTyping}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </main>

      {isSettingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <header className="modal-header">
              <h3>Настройки сложности</h3>
              <button className="close-button" onClick={() => setIsSettingsModalOpen(false)}>
                &times;
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
                              <span key={idx} className="phrase-tag">{phrase}</span>
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
                Сохранить
              </button>
            </footer>
          </div>
        </div>
      )}
      
      {isArchiveModalOpen && (
        <div className="modal-overlay">
          <div className="modal archive-modal">
            <header className="modal-header">
              <h3>Архив чатов</h3>
              <button className="close-button" onClick={() => setIsArchiveModalOpen(false)}>
                &times;
              </button>
            </header>
            <div className="modal-content">
              <div className="archive-controls">
                <button className="save-button" onClick={saveChatToDB}>
                  Сохранить текущий чат
                </button>
                <button className="export-all-button" onClick={handleExportAllChats}>
                  Экспортировать все чаты
                </button>
                <label className="button-upload">
                  Загрузить JSON из файла
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
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
        <div className="modal-overlay">
          <div className="modal chat-view-modal">
            <header className="modal-header">
              <h3>Просмотр чата</h3>
              <button className="close-button" onClick={() => { setIsChatViewModalOpen(false); setViewingChat(null); }}>
                &times;
              </button>
            </header>
            <div className="modal-content chat-view-content">
              <div className="messages view-messages">
                {viewingChat.chatHistory.map((msg, index) => (
                  <div key={index} className={`message-container ${msg.sender}`}>
                    <div className={`message ${msg.sender}`}>
                      <div className="bubble">
                        <div className="message-text">{msg.text}</div>
                      </div>
                      <div className="timestamp">{msg.timestamp}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="edit-button" onClick={handleEditChat}>
                Продолжить этот чат
              </button>
              <button className="close-button" onClick={() => { setIsChatViewModalOpen(false); setViewingChat(null); }}>
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