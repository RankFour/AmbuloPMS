(function () {
  // Inject Font Awesome first
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesomeLink = document.createElement("link");
    fontAwesomeLink.rel = "stylesheet";
    fontAwesomeLink.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(fontAwesomeLink);
  }

  // Inject CSS (keeping original purple/blue colors)
  const style = document.createElement("style");
  style.textContent = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

.chatbot-container {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 999999;
    display: flex;
    align-items: flex-end;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    height: auto;
}

        .chat-button {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            position: absolute;
            right: 20px;
        }

        .chat-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }

        .chat-button svg {
            width: 32px;
            height: 32px;
            fill: white;
        }

.chat-window {
    position: fixed;
    right: 0;
    bottom: 0;
    width: 0;
    height: 80vh;
    max-height: 600px;
    background: white;
    box-shadow: -4px 0 32px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.3s ease;
}

        .chat-window.open {
            width: 400px;
        }

        .chat-window.expanded {
            width: 600px;
        }

        .chat-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .chat-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .avatar svg {
            width: 24px;
            height: 24px;
            fill: #667eea;
        }

        .chat-title {
            font-size: 16px;
            font-weight: 600;
        }

        .chat-status {
            font-size: 12px;
            opacity: 0.9;
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .header-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .header-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .header-btn svg {
            width: 18px;
            height: 18px;
            fill: white;
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f7f9fc;
        }

        .message {
            margin-bottom: 16px;
            display: flex;
            gap: 8px;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .message.user {
            flex-direction: row-reverse;
        }

        .message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }

        .message.bot .message-avatar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .message.user .message-avatar {
            background: #e0e7ff;
            color: #667eea;
        }

        .message-content {
            max-width: 70%;
        }

        .message-bubble {
            padding: 12px 16px;
            border-radius: 16px;
            word-wrap: break-word;
            white-space: pre-wrap;
        }

        .message.bot .message-bubble {
            background: white;
            color: #333;
            border-bottom-left-radius: 4px;
        }

        .message.user .message-bubble {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .message-image {
            max-width: 200px;
            border-radius: 12px;
            margin-top: 8px;
        }

        .message-time {
            font-size: 11px;
            opacity: 0.6;
            margin-top: 4px;
            padding: 0 4px;
        }

        .message-options {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 10px;
            animation: slideIn 0.3s ease;
        }

        .option-button {
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            background: white;
            border-radius: 10px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            text-align: left;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .option-button:hover:not(:disabled) {
            border-color: #667eea;
            background: #f5f7ff;
            transform: translateX(4px);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
        }

        .option-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .option-button i {
            font-size: 14px;
            color: #667eea;
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 12px 16px;
        }

        .typing-indicator span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #667eea;
            animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% {
                transform: translateY(0);
                opacity: 0.7;
            }
            30% {
                transform: translateY(-10px);
                opacity: 1;
            }
        }

        .quick-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 16px;
            animation: slideIn 0.3s ease;
        }

        .quick-action-btn {
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            background: white;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            transition: all 0.2s;
        }

        .quick-action-btn:hover {
            border-color: #667eea;
            background: #f5f7ff;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.15);
        }

        .quick-action-btn svg {
            width: 20px;
            height: 20px;
            fill: #667eea;
            flex-shrink: 0;
        }

        .chat-input-container {
            padding: 16px;
            background: white;
            border-top: 1px solid #e5e7eb;
        }

        .chat-input-wrapper {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .input-actions {
            display: flex;
            gap: 4px;
        }

        .input-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: #f3f4f6;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .input-btn:hover {
            background: #e5e7eb;
        }

        .input-btn svg {
            width: 20px;
            height: 20px;
            fill: #6b7280;
        }

        .chat-input {
            flex: 1;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            outline: none;
            font-size: 14px;
            resize: none;
            max-height: 100px;
            min-height: 36px;
            font-family: inherit;
        }

        .chat-input:focus {
            border-color: #667eea;
        }

        .send-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .send-btn:hover {
            transform: scale(1.05);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .send-btn svg {
            width: 18px;
            height: 18px;
            fill: white;
        }

        .image-preview-container {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }

        .image-preview {
            position: relative;
            width: 80px;
            height: 80px;
            border-radius: 8px;
            overflow: hidden;
        }

        .image-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .remove-image {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .reset-confirmation {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px;
            background: #fee2e2;
            border-radius: 12px;
            margin-top: 12px;
            border: 2px solid #ef4444;
            animation: slideIn 0.3s ease;
        }

        .reset-confirmation-text {
            font-size: 14px;
            color: #991b1b;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .reset-confirmation-text i {
            font-size: 18px;
            color: #dc2626;
        }

        .reset-actions {
            display: flex;
            gap: 8px;
        }

        .reset-btn-action {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .reset-btn-confirm {
            background: #ef4444;
            color: white;
        }

        .reset-btn-confirm:hover {
            background: #dc2626;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
        }

        .reset-btn-cancel {
            background: white;
            color: #6b7280;
            border: 2px solid #e5e7eb;
        }

        .reset-btn-cancel:hover {
            background: #f3f4f6;
        }

        .reset-btn-action i {
            font-size: 14px;
        }

        input[type="file"] {
            display: none;
        }

        .admin-connect-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
            padding: 12px;
            background: #fef3c7;
            border-radius: 12px;
            border: 2px solid #fbbf24;
            animation: slideIn 0.3s ease;
        }

        .admin-connect-text {
            font-size: 13px;
            color: #92400e;
            font-weight: 500;
        }

        .admin-actions {
            display: flex;
            gap: 8px;
        }

        .admin-btn {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .admin-btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .admin-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }

        .admin-btn-secondary {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }

        .admin-btn-secondary:hover {
            background: #f5f7ff;
        }

        .admin-btn i {
            font-size: 14px;
        }

        .connecting-admin {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: #dbeafe;
            border-radius: 12px;
            margin-top: 12px;
            color: #1e40af;
            font-size: 13px;
            font-weight: 500;
        }

        .connecting-admin .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #3b82f6;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .admin-connected {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: #d1fae5;
            border-radius: 12px;
            margin-top: 12px;
            color: #065f46;
            font-size: 13px;
            font-weight: 500;
        }

        .admin-connected i {
            color: #10b981;
            font-size: 16px;
        }
    `;
  document.head.appendChild(style);

  // Inject HTML
  const chatbotHTML = `
        <div class="chatbot-container">
            <button class="chat-button" id="chatButton">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.68-.29-3.86-.81l-.28-.13-2.9.49.49-2.9-.13-.28C4.79 14.68 4.5 13.38 4.5 12c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5z"/>
                    <circle cx="9" cy="12" r="1"/>
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="15" cy="12" r="1"/>
                </svg>
            </button>

            <div class="chat-window" id="chatWindow">
                <div class="chat-header">
                    <div class="chat-header-left">
                        <div class="avatar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-robot" viewBox="0 0 16 16">
                            <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5M3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.6 26.6 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.93.93 0 0 1-.765.935c-.845.147-2.34.346-4.235.346s-3.39-.2-4.235-.346A.93.93 0 0 1 3 9.219zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a25 25 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25 25 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135"/>
                            <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2zM14 7.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5"/>
                            </svg>
                        </div>
                        <div>
                            <div class="chat-title">Commercial Space Assistant</div>
                            <div class="chat-status" id="statusText">Online</div>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="header-btn" id="resetBtn" title="Reset Chat">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                            </svg>
                        </button>
                        <button class="header-btn" id="expandBtn" title="Expand">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                            </svg>
                        </button>
                        <button class="header-btn" id="closeBtn" title="Close">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="chat-messages" id="chatMessages">
                    <div class="message bot">
                        <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
                        <div class="message-content">
                            <div class="message-bubble">Hi! I'm your commercial space assistant. How can I help you today?</div>
                            <div class="message-time">Just now</div>
                        </div>
                    </div>
                    <div class="quick-actions" id="quickActions">
                        <button class="quick-action-btn" data-action="inquiry">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                            </svg>
                            General Inquiry
                        </button>
                        <button class="quick-action-btn" data-action="maintenance">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                            </svg>
                            Maintenance
                        </button>
                        <button class="quick-action-btn" data-action="account">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                            </svg>
                            Create Account
                        </button>
                        <button class="quick-action-btn" data-action="help">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 16h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 11.9 13 12.5 13 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                            </svg>
                            Help & Support
                        </button>
                    </div>
                </div>

                <div class="chat-input-container">
                    <div class="image-preview-container" id="imagePreviews"></div>
                    <div class="chat-input-wrapper">
                        <div class="input-actions">
                            <button class="input-btn" id="imageBtn" title="Attach image">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </button>
                            <input type="file" id="imageInput" accept="image/*" multiple>
                        </div>
                        <textarea class="chat-input" id="chatInput" placeholder="Type a message..." rows="1"></textarea>
                        <button class="send-btn" id="sendBtn">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", chatbotHTML);

  // COMMERCIAL SPACE RESPONSE SYSTEM - Focused on inquiries, maintenance, accounts, and support
  const responses = {
    // Main quick action responses
    inquiry: {
      text: "Thank you for reaching out! I'd be happy to help with your commercial space inquiry. What would you like to know more about?",
      options: [
        {
          label: "Available Spaces",
          value: "spaces_available",
          icon: "fa-building",
        },
        {
          label: "Lease Terms & Pricing",
          value: "lease_terms",
          icon: "fa-file-contract",
        },
        {
          label: "Space Features",
          value: "space_features",
          icon: "fa-list-check",
        },
        {
          label: "Location & Amenities",
          value: "location_amenities",
          icon: "fa-map-location-dot",
        },
      ],
    },
    maintenance: {
      text: "I'm here to help with your maintenance request for your commercial space. To ensure we dispatch the right specialist, what type of issue are you experiencing?",
      options: [
        {
          label: "HVAC/Climate Control",
          value: "maint_hvac",
          icon: "fa-temperature-high",
        },
        { label: "Plumbing Issue", value: "maint_plumbing", icon: "fa-faucet" },
        {
          label: "Electrical Problem",
          value: "maint_electrical",
          icon: "fa-bolt",
        },
        {
          label: "Structural/Building",
          value: "maint_structural",
          icon: "fa-building-circle-exclamation",
        },
      ],
    },
    account: {
      text: "Wonderful! I'll help you get set up with an account. What type of account do you need?",
      options: [
        {
          label: "Tenant Portal Access",
          value: "account_tenant",
          icon: "fa-key",
        },
        {
          label: "Prospective Tenant",
          value: "account_prospect",
          icon: "fa-user-plus",
        },
        {
          label: "Property Owner/Landlord",
          value: "account_owner",
          icon: "fa-building-user",
        },
        {
          label: "Vendor/Contractor",
          value: "account_vendor",
          icon: "fa-toolbox",
        },
      ],
    },
    help: {
      text: "I'm here to assist you! Let me know which area you need help with:",
      options: [
        {
          label: "Lease Agreement Help",
          value: "help_lease",
          icon: "fa-file-signature",
        },
        {
          label: "Payment & Billing",
          value: "help_billing",
          icon: "fa-credit-card",
        },
        {
          label: "Property Access",
          value: "help_access",
          icon: "fa-door-open",
        },
        {
          label: "General Support",
          value: "help_general",
          icon: "fa-circle-info",
        },
      ],
    },

    // Inquiry follow-ups
    spaces_available: {
      text: "We have several commercial spaces available. What type of space are you looking for?",
      options: [
        { label: "Office Space", value: "space_office", icon: "fa-briefcase" },
        { label: "Retail Space", value: "space_retail", icon: "fa-store" },
        {
          label: "Warehouse/Industrial",
          value: "space_warehouse",
          icon: "fa-warehouse",
        },
        {
          label: "Mixed-Use Space",
          value: "space_mixed",
          icon: "fa-building-circle-check",
        },
      ],
    },

    space_office:
      "Our office spaces range from 500 to 10,000 sq ft with flexible layouts, modern amenities, and convenient locations. What size office are you looking for, and do you have any specific location preferences?",

    space_retail:
      "We offer retail spaces in high-traffic areas with excellent visibility. Square footage ranges from 800 to 5,000 sq ft. Are you looking for ground-floor storefront, shopping center space, or standalone building?",

    space_warehouse:
      "Our warehouse and industrial spaces range from 5,000 to 50,000 sq ft with varying ceiling heights, loading docks, and office space combinations. What are your primary space requirements?",

    space_mixed:
      "Mixed-use spaces combine office, retail, or residential elements. These are great for businesses needing flexibility. What combination of space types interests you most?",

    lease_terms: {
      text: "I can help you understand our lease terms and pricing. What specific information do you need?",
      options: [
        { label: "Rental Rates", value: "terms_rates", icon: "fa-dollar-sign" },
        {
          label: "Lease Duration Options",
          value: "terms_duration",
          icon: "fa-calendar-days",
        },
        {
          label: "Included Services",
          value: "terms_services",
          icon: "fa-list-check",
        },
        {
          label: "Security Deposit",
          value: "terms_deposit",
          icon: "fa-shield-halved",
        },
      ],
    },

    terms_rates:
      "Our rental rates vary by location, size, and space type. Commercial rates typically range from $15-50 per square foot annually depending on the property. Would you like me to connect you with a leasing agent who can provide specific pricing for properties that match your needs?",

    terms_duration:
      "We offer flexible lease terms:\n\n• Short-term: 1-2 years (higher rates, more flexibility)\n• Standard: 3-5 years (balanced rates)\n• Long-term: 5-10+ years (best rates, tenant improvements possible)\n\nWhat lease duration are you considering?",

    terms_services:
      "Most commercial leases include:\n\n✓ Property maintenance\n✓ Common area upkeep\n✓ Building insurance\n✓ Property management\n\nUtilities, janitorial, and interior maintenance vary by lease type (gross vs. triple net). Would you like details on lease structures?",

    terms_deposit:
      "Security deposits typically range from 1-3 months' rent depending on:\n• Creditworthiness\n• Business history\n• Lease terms\n• Space modifications needed\n\nFirst and last month's rent is also commonly required. Do you have questions about the deposit process?",

    space_features: {
      text: "Our commercial spaces offer various features. What's most important to you?",
      options: [
        {
          label: "Parking Availability",
          value: "feature_parking",
          icon: "fa-square-parking",
        },
        {
          label: "Building Amenities",
          value: "feature_amenities",
          icon: "fa-building",
        },
        {
          label: "Technology/Infrastructure",
          value: "feature_tech",
          icon: "fa-wifi",
        },
        {
          label: "Accessibility",
          value: "feature_access",
          icon: "fa-wheelchair",
        },
      ],
    },

    feature_parking:
      "Parking ratios vary by property:\n• Office: Typically 3-4 spaces per 1,000 sq ft\n• Retail: 4-5 spaces per 1,000 sq ft\n• Warehouse: 1-2 spaces per 1,000 sq ft\n\nWe offer surface lots, covered parking, and garage options. What are your parking needs?",

    feature_amenities:
      "Building amenities may include:\n\n✓ Conference rooms\n✓ Break rooms/kitchens\n✓ Fitness centers\n✓ Loading docks\n✓ Security systems\n✓ Elevators\n✓ Reception areas\n\nWhich amenities are essential for your business?",

    feature_tech:
      "Technology features include:\n\n✓ High-speed fiber internet\n✓ Multiple telecom providers\n✓ Structured cabling\n✓ Backup power systems\n✓ Smart building systems\n✓ Security access controls\n\nWhat are your connectivity requirements?",

    feature_access:
      "All our properties comply with ADA requirements including:\n\n✓ Accessible entrances\n✓ Elevators (multi-story buildings)\n✓ Accessible restrooms\n✓ Designated parking\n✓ Proper door widths and thresholds\n\nDo you have specific accessibility needs we should know about?",

    location_amenities: {
      text: "Location is crucial for business success. What's your priority?",
      options: [
        {
          label: "Proximity to Transit",
          value: "location_transit",
          icon: "fa-train-subway",
        },
        {
          label: "Near Highways/Roads",
          value: "location_highways",
          icon: "fa-road",
        },
        {
          label: "Downtown/Urban",
          value: "location_downtown",
          icon: "fa-city",
        },
        {
          label: "Suburban/Business Park",
          value: "location_suburban",
          icon: "fa-tree-city",
        },
      ],
    },

    location_transit:
      "Transit-accessible locations are valuable for employee commutes and customer access. We have properties near major subway, bus, and rail lines. Which transit lines or areas interest you?",

    location_highways:
      "Highway access is essential for logistics and customer reach. We have properties with direct access to major highways and arterial roads. What highways or areas are you targeting?",

    location_downtown:
      "Downtown locations offer prestige, foot traffic, and amenities. These command premium rates but provide excellent visibility and access to talent. Which downtown areas interest you?",

    location_suburban:
      "Suburban business parks offer:\n• Lower rental rates\n• Ample parking\n• Modern facilities\n• Growing business communities\n\nWhich suburban areas are you considering?",

    // Maintenance follow-ups
    maint_hvac:
      "I've logged your HVAC issue with priority. To help our technicians come prepared, please describe:\n\n• No heating or cooling?\n• Temperature inconsistencies?\n• Strange noises?\n• Thermostat problems?\n• Unusual odors?\n\nWhat symptoms are you experiencing?",

    maint_plumbing:
      "I've noted your plumbing concern. Please describe the issue:\n\n• Leaking fixtures or pipes?\n• Clogged drains?\n• No water/low pressure?\n• Water heater problems?\n• Restroom issues?\n\nProvide details and we'll respond within 24 hours.",

    maint_electrical:
      "⚠️ Electrical issues require immediate attention. Please describe:\n\n• Power outage (partial/complete)?\n• Flickering lights?\n• Outlets not working?\n• Circuit breaker issues?\n• Burning smell or sparks?\n\n🚨 EMERGENCY? If you see sparks, smell burning, or have safety concerns, call our 24/7 line: (555) 911-HELP",

    maint_structural:
      "Structural or building issues are important. Please describe:\n\n• Roof leaks?\n• Door/window problems?\n• Flooring damage?\n• Wall cracks or damage?\n• Foundation concerns?\n• Pest control needs?\n\nWhat issue are you experiencing?",

    // Account creation follow-ups
    account_tenant: {
      text: "Great! Setting up your tenant portal access. This gives you:",
      options: [
        {
          label: "Start Registration",
          value: "tenant_register",
          icon: "fa-pen-to-square",
        },
        {
          label: "Portal Features",
          value: "tenant_features",
          icon: "fa-desktop",
        },
        {
          label: "Help Logging In",
          value: "tenant_login_help",
          icon: "fa-circle-question",
        },
      ],
    },

    tenant_register:
      "To create your tenant portal account, I'll need:\n\n📝 Full Name:\n📧 Email Address:\n🏢 Property/Unit Number:\n📱 Phone Number:\n🆔 Lease Agreement Number (if available):\n\nOnce submitted, you'll receive login credentials within 24 hours.",

    tenant_features:
      "Tenant Portal Features:\n\n✓ Pay rent online\n✓ Submit maintenance requests\n✓ View lease documents\n✓ Track payment history\n✓ Receive important notices\n✓ Access community resources\n✓ Contact property management\n\nReady to create your account?",

    tenant_login_help:
      "Having trouble logging in?\n\n• Forgot password? Use the 'Reset Password' link\n• Account not activated? Check your email (including spam)\n• Username issues? Try your email address\n• Still stuck? Call (555) 123-4567\n\nWhat specific issue are you facing?",

    account_prospect:
      "Welcome! Creating a prospective tenant account lets you:\n\n✓ Save favorite properties\n✓ Schedule tours easily\n✓ Track applications\n✓ Receive new listing alerts\n✓ Access property details\n\nPlease provide:\n• Name\n• Email\n• Phone\n• Type of space sought\n\nShall we get started?",

    account_owner:
      "Property owner accounts provide:\n\n✓ Portfolio management\n✓ Tenant communications\n✓ Financial reporting\n✓ Maintenance tracking\n✓ Lease management\n✓ Document storage\n\nPlease provide:\n• Full Name\n• Company Name (if applicable)\n• Email\n• Phone\n• Properties Owned\n\nReady to set up your account?",

    account_vendor:
      "Vendor/Contractor portal access includes:\n\n✓ Work order management\n✓ Invoice submission\n✓ Property access schedules\n✓ Compliance documentation\n✓ Payment tracking\n\nPlease provide:\n• Company Name\n• Contact Person\n• Email\n• Phone\n• Services Provided\n• License/Insurance Info\n\nShall I start your registration?",

    // Help & Support follow-ups
    help_lease: {
      text: "I can help with lease-related questions. What do you need assistance with?",
      options: [
        {
          label: "Understanding My Lease",
          value: "lease_understand",
          icon: "fa-book-open",
        },
        {
          label: "Lease Renewal",
          value: "lease_renewal",
          icon: "fa-arrows-rotate",
        },
        { label: "Lease Modification", value: "lease_modify", icon: "fa-pen" },
        {
          label: "Early Termination",
          value: "lease_terminate",
          icon: "fa-door-open",
        },
      ],
    },

    lease_understand:
      "Common lease questions:\n\n• Gross vs. Triple Net (NNN) lease structures\n• CAM (Common Area Maintenance) charges\n• Escalation clauses\n• Renewal options\n• Tenant improvement allowances\n\nWhat specific aspect of your lease would you like explained?",

    lease_renewal:
      "Lease renewals typically require 60-90 days notice. The process involves:\n\n1. Review current lease terms\n2. Discuss renewal options\n3. Negotiate new rates if applicable\n4. Execute renewal agreement\n\nWhen does your current lease expire? I can connect you with management to discuss renewal terms.",

    lease_modify:
      "Lease modifications may include:\n\n• Expanding or reducing space\n• Adding/removing services\n• Changing lease terms\n• Updating contact information\n\nModifications typically require landlord approval and a formal amendment. What modification are you seeking?",

    lease_terminate:
      "Early lease termination considerations:\n\n• Review termination clauses in your lease\n• Early termination fees may apply\n• Notice requirements (typically 30-90 days)\n• Potential buyout options\n• Security deposit implications\n\nI recommend speaking with property management about your specific situation. Would you like me to connect you?",

    help_billing: {
      text: "I can assist with billing and payment questions. What do you need help with?",
      options: [
        {
          label: "Payment Methods",
          value: "billing_methods",
          icon: "fa-money-check",
        },
        {
          label: "Billing Questions",
          value: "billing_questions",
          icon: "fa-circle-question",
        },
        { label: "Late Payment", value: "billing_late", icon: "fa-clock" },
        {
          label: "Payment History",
          value: "billing_history",
          icon: "fa-receipt",
        },
      ],
    },

    billing_methods:
      "We accept multiple payment methods:\n\n💳 Credit/Debit Cards (online portal)\n🏦 ACH/Electronic Transfer\n💵 Check (mail or in-person)\n📱 Online Payment Portal\n🔄 Auto-pay Setup\n\nWhich payment method would you like to use or learn more about?",

    billing_questions:
      "Common billing questions:\n\n• Rent due date: Typically 1st of month\n• CAM charges: Calculated annually\n• Utility billing: Varies by lease type\n• Late fees: Usually 5-10% after grace period\n• Pro-rated rent: For partial months\n\nWhat specific billing question do you have?",

    billing_late:
      "If you're unable to make a payment on time:\n\n1. Contact management immediately\n2. Explain your situation\n3. Discuss payment arrangements\n4. Avoid default status\n\n⚠️ Late payments may incur fees and affect credit. Would you like me to connect you with our billing department?",

    billing_history:
      "To access your payment history:\n\n1. Log into tenant portal\n2. Navigate to 'Billing' section\n3. View/download statements\n4. Print payment receipts\n\nAlternatively, I can have statements emailed to you. Would you like me to arrange that?",

    help_access: {
      text: "Property access assistance. What do you need help with?",
      options: [
        { label: "Access Cards/Keys", value: "access_keys", icon: "fa-key" },
        { label: "After-Hours Access", value: "access_hours", icon: "fa-moon" },
        {
          label: "Visitor/Guest Access",
          value: "access_visitors",
          icon: "fa-users",
        },
        { label: "Lost/Stolen Access", value: "access_lost", icon: "fa-lock" },
      ],
    },

    access_keys:
      "Access card/key information:\n\n• Cards issued at lease signing\n• Programmed for your specific areas\n• Replacement fee: $25-50\n• Allow 24-48 hours for programming\n\nNeed a new card or key? Provide your name and unit number.",

    access_hours:
      "After-hours access varies by property:\n\n• Some have 24/7 access\n• Others require advance notice\n• Security may need notification\n• Emergency access always available\n\nWhat property are you asking about? I can check the specific access hours.",

    access_visitors:
      "Visitor/guest access procedures:\n\n• Notify security/reception in advance\n• Provide visitor names\n• Issue temporary passes\n• Escort may be required\n• Sign-in at reception\n\nAre you expecting visitors? I can help arrange access.",

    access_lost:
      "Lost or stolen access card/key:\n\n🚨 Report immediately to security\n✓ We'll deactivate old credentials\n✓ Issue replacement ($25-50 fee)\n✓ Update access logs\n✓ File report if theft suspected\n\nPlease provide your name and unit number to report lost access.",

    help_general:
      "I'm here to help with:\n\n• Property information\n• Maintenance requests\n• Lease questions\n• Billing inquiries\n• Account access\n• General support\n\nWhat can I assist you with today?",

    // Common keywords
    hello:
      "Hello! Welcome to Commercial Space Support. How can I assist you today?",
    hi: "Hi there! I'm here to help with your commercial space needs. What can I do for you?",
    hey: "Hey! How can I help you with your commercial space today?",
    thanks: "You're very welcome! Is there anything else I can help you with?",
    "thank you":
      "My pleasure! Don't hesitate to reach out if you need anything else.",
    bye: "Goodbye! Feel free to return anytime you need assistance. Have a great day!",

    // Trigger admin connection
    urgent: {
      text: "I understand this is urgent. Let me connect you with a property manager who can help immediately.",
      needsAdmin: true,
    },
    speak: {
      text: "I'd be happy to connect you with a property manager for personalized assistance.",
      needsAdmin: true,
    },
    talk: {
      text: "Would you like to speak with a property manager? They can provide direct support.",
      needsAdmin: true,
    },
    human: {
      text: "I can connect you with a property manager for personalized help.",
      needsAdmin: true,
    },
    agent: {
      text: "Let me connect you with a property manager right away.",
      needsAdmin: true,
    },
    manager: {
      text: "I can connect you with a property manager who can assist you further.",
      needsAdmin: true,
    },
    person: {
      text: "Would you prefer to work with a property manager? I can connect you.",
      needsAdmin: true,
    },

    // Default
    default:
      "I'd like to make sure I understand your needs correctly. Could you tell me more about what you need help with, or select one of the quick options above?",
  };

  // Initialize JavaScript
  const chatButton = document.getElementById("chatButton");
  const chatWindow = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("closeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const expandBtn = document.getElementById("expandBtn");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const imageBtn = document.getElementById("imageBtn");
  const imageInput = document.getElementById("imageInput");
  const imagePreviews = document.getElementById("imagePreviews");
  const quickActions = document.getElementById("quickActions");
  const statusText = document.getElementById("statusText");

  let selectedImages = [];
  let conversationHistory = [];
  let messagesSinceLastAdminOffer = 0;
  let adminConnected = false;
  const MESSAGES_BEFORE_ADMIN_OFFER = 3;

  chatButton.addEventListener("click", () => {
    chatWindow.classList.toggle("open");
  });

  closeBtn.addEventListener("click", () => {
    chatWindow.classList.remove("open");
  });

  resetBtn.addEventListener("click", () => {
    showResetConfirmation();
  });

  expandBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("expanded");
  });

  function resetChat() {
    conversationHistory = [];
    selectedImages = [];
    messagesSinceLastAdminOffer = 0;
    adminConnected = false;
    renderImagePreviews();

    chatMessages.innerHTML = "";

    const welcomeMsg = document.createElement("div");
    welcomeMsg.className = "message bot";
    welcomeMsg.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                <div class="message-bubble">Hi! I'm your commercial space assistant. How can I help you today?</div>
                <div class="message-time">${getTime()}</div>
            </div>
        `;
    chatMessages.appendChild(welcomeMsg);

    addQuickActions();

    chatInput.value = "";
    chatInput.style.height = "auto";
    statusText.textContent = "Online";

    console.log("Chat reset successfully");
  }

  function showResetConfirmation() {
    if (document.getElementById("resetConfirmation")) {
      return;
    }

    const confirmDiv = document.createElement("div");
    confirmDiv.className = "reset-confirmation";
    confirmDiv.id = "resetConfirmation";
    confirmDiv.innerHTML = `
            <div class="reset-confirmation-text">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Are you sure you want to reset the chat? This will clear all messages and conversation history.
            </div>
            <div class="reset-actions">
                <button class="reset-btn-action reset-btn-confirm" onclick="window.confirmResetChat()">
                    <i class="fa-solid fa-check"></i>
                    Yes, Reset Chat
                </button>
                <button class="reset-btn-action reset-btn-cancel" onclick="window.cancelResetChat()">
                    <i class="fa-solid fa-xmark"></i>
                    Cancel
                </button>
            </div>
        `;
    chatMessages.appendChild(confirmDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  window.confirmResetChat = function () {
    const confirmDiv = document.getElementById("resetConfirmation");
    if (confirmDiv) {
      confirmDiv.remove();
    }
    resetChat();
  };

  window.cancelResetChat = function () {
    const confirmDiv = document.getElementById("resetConfirmation");
    if (confirmDiv) {
      confirmDiv.remove();
    }
    addBotMessage("No problem! Your conversation has been preserved.");
  };

  function addQuickActions() {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "quick-actions";
    actionsDiv.id = "quickActions";
    actionsDiv.style.display = "grid";
    actionsDiv.innerHTML = `
            <button class="quick-action-btn" data-action="inquiry">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                </svg>
                General Inquiry
            </button>
            <button class="quick-action-btn" data-action="maintenance">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                </svg>
                Maintenance
            </button>
            <button class="quick-action-btn" data-action="account">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
                Create Account
            </button>
            <button class="quick-action-btn" data-action="help">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 16h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 11.9 13 12.5 13 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                </svg>
                Help & Support
            </button>
        `;
    chatMessages.appendChild(actionsDiv);
    actionsDiv.addEventListener("click", handleQuickAction);
  }

  function handleQuickAction(e) {
    const btn = e.target.closest(".quick-action-btn");
    if (btn) {
      const action = btn.getAttribute("data-action");
      const quickActionsEl = document.getElementById("quickActions");
      if (quickActionsEl) {
        quickActionsEl.style.display = "none";
      }

      const actionMessages = {
        inquiry: "I have a general inquiry about commercial space",
        maintenance: "I need to request maintenance for my space",
        account: "I'd like to create an account",
        help: "I need help and support",
      };

      sendMessage(actionMessages[action]);
    }
  }

  document
    .getElementById("quickActions")
    .addEventListener("click", handleQuickAction);

  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 100) + "px";
  });

  imageBtn.addEventListener("click", () => {
    imageInput.click();
  });

  imageInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          selectedImages.push({
            src: e.target.result,
            file: file,
          });
          renderImagePreviews();
        };
        reader.readAsDataURL(file);
      }
    });
    imageInput.value = "";
  });

  function renderImagePreviews() {
    imagePreviews.innerHTML = "";
    selectedImages.forEach((img, index) => {
      const preview = document.createElement("div");
      preview.className = "image-preview";
      preview.innerHTML = `
                <img src="${img.src}" alt="Preview">
                <button class="remove-image" onclick="window.chatbotRemoveImage(${index})">×</button>
            `;
      imagePreviews.appendChild(preview);
    });
  }

  window.chatbotRemoveImage = function (index) {
    selectedImages.splice(index, 1);
    renderImagePreviews();
  };

  function getTime() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function addUserMessage(text, images = []) {
    const time = getTime();
    const messageDiv = document.createElement("div");
    messageDiv.className = "message user";

    let imagesHtml = "";
    if (images.length > 0) {
      imagesHtml = images
        .map(
          (img) =>
            `<img src="${img.src}" class="message-image" alt="Attached image">`
        )
        .join("");
    }
    messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="message-content">
                ${
                  text
                    ? `<div class="message-bubble">${escapeHtml(text)}</div>`
                    : ""
                }
                ${imagesHtml}
                <div class="message-time">${time}</div>
            </div>
        `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addBotMessage(text, options = null) {
    const time = getTime();
    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot";

    let optionsHtml = "";
    if (options && options.length > 0) {
      optionsHtml = '<div class="message-options">';
      options.forEach((option) => {
        optionsHtml += `
                    <button class="option-button" data-option-value="${option.value}">
                        <i class="fa-solid ${option.icon}"></i>
                        ${option.label}
                    </button>
                `;
      });
      optionsHtml += "</div>";
    }

    messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                <div class="message-bubble">${escapeHtml(text)}</div>
                ${optionsHtml}
                <div class="message-time">${time}</div>
            </div>
        `;

    chatMessages.appendChild(messageDiv);

    if (options && options.length > 0) {
      const optionButtons = messageDiv.querySelectorAll(".option-button");
      optionButtons.forEach((btn) => {
        btn.addEventListener("click", function () {
          optionButtons.forEach((b) => (b.disabled = true));

          const optionValue = this.getAttribute("data-option-value");
          const optionLabel = this.textContent.trim();

          addUserMessage(optionLabel, []);
          processOptionSelection(optionValue);
        });
      });
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function processOptionSelection(optionValue) {
    conversationHistory.push({
      role: "user",
      message: optionValue,
      timestamp: new Date().toISOString(),
    });

    if (!adminConnected) {
      messagesSinceLastAdminOffer++;
    }

    showTypingIndicator();
    sendBtn.disabled = true;

    const delay = Math.random() * 1000 + 500;

    setTimeout(() => {
      removeTypingIndicator();

      let botResponse = responses[optionValue] || responses.default;
      let needsAdmin = false;
      let responseOptions = null;

      if (typeof botResponse === "object" && botResponse.text) {
        responseOptions = botResponse.options || null;
        needsAdmin = botResponse.needsAdmin || false;
        botResponse = botResponse.text;
      }

      addBotMessage(botResponse, responseOptions);

      conversationHistory.push({
        role: "bot",
        message: botResponse,
        timestamp: new Date().toISOString(),
      });

      if (
        !adminConnected &&
        (needsAdmin ||
          messagesSinceLastAdminOffer >= MESSAGES_BEFORE_ADMIN_OFFER)
      ) {
        if (!document.getElementById("adminConnectOption")) {
          setTimeout(() => {
            showAdminConnectOption();
            messagesSinceLastAdminOffer = 0;
          }, 800);
        }
      }

      sendBtn.disabled = false;
    }, delay);
  }

  function showAdminConnectOption() {
    const adminDiv = document.createElement("div");
    adminDiv.className = "admin-connect-container";
    adminDiv.id = "adminConnectOption";
    adminDiv.innerHTML = `
            <div class="admin-connect-text">
                <i class="fa-solid fa-user-headset"></i> Would you like to speak with a property manager for personalized assistance?
            </div>
            <div class="admin-actions">
                <button class="admin-btn admin-btn-primary" onclick="window.connectToAdmin()">
                    <i class="fa-solid fa-headset"></i>
                    Connect Now
                </button>
                <button class="admin-btn admin-btn-secondary" onclick="window.dismissAdminOption()">
                    <i class="fa-solid fa-xmark"></i>
                    No Thanks
                </button>
            </div>
        `;
    chatMessages.appendChild(adminDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  window.connectToAdmin = function () {
    const adminOption = document.getElementById("adminConnectOption");
    if (adminOption) {
      adminOption.remove();
    }

    const connectingDiv = document.createElement("div");
    connectingDiv.className = "connecting-admin";
    connectingDiv.id = "connectingAdmin";
    connectingDiv.innerHTML = `
            <div class="spinner"></div>
            <span>Connecting you to a property manager...</span>
        `;
    chatMessages.appendChild(connectingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
      const connecting = document.getElementById("connectingAdmin");
      if (connecting) {
        connecting.remove();
      }

      const connectedDiv = document.createElement("div");
      connectedDiv.className = "admin-connected";
      connectedDiv.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                <span>Connected to Property Management. A specialist will respond shortly.</span>
            `;
      chatMessages.appendChild(connectedDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      adminConnected = true;
      statusText.textContent = "Manager Connected";

      setTimeout(() => {
        addBotMessage(
          "Hello! This is Jennifer from property management. I've reviewed your conversation and I'm here to help. What can I assist you with?"
        );
      }, 1500);
    }, 2000);
  };

  window.dismissAdminOption = function () {
    const adminOption = document.getElementById("adminConnectOption");
    if (adminOption) {
      adminOption.remove();
    }
    addBotMessage(
      "No problem! I'll continue to assist you. Feel free to ask if you change your mind later."
    );
  };

  function showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.className = "message bot";
    typingDiv.id = "typingIndicator";
    typingDiv.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
      indicator.remove();
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function findResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase().trim();

    for (const [keyword, response] of Object.entries(responses)) {
      if (keyword === "default") continue;
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }

    return responses.default;
  }

  async function sendMessage(text = null) {
    const messageText = text || chatInput.value.trim();
    if (!messageText && selectedImages.length === 0) return;

    const quickActionsEl = document.getElementById("quickActions");
    if (quickActionsEl && quickActionsEl.style.display !== "none") {
      quickActionsEl.style.display = "none";
    }

    addUserMessage(messageText, selectedImages);

    if (!text) {
      chatInput.value = "";
      chatInput.style.height = "auto";
    }

    const userImages = [...selectedImages];
    selectedImages = [];
    renderImagePreviews();

    conversationHistory.push({
      role: "user",
      message: messageText,
      timestamp: new Date().toISOString(),
    });

    if (!adminConnected) {
      messagesSinceLastAdminOffer++;
    }

    showTypingIndicator();
    sendBtn.disabled = true;

    const delay = Math.random() * 1000 + 500;

    setTimeout(() => {
      removeTypingIndicator();

      let botResponse;
      let needsAdmin = false;
      let responseOptions = null;

      const response = findResponse(messageText);

      if (typeof response === "object") {
        botResponse = response.text;
        needsAdmin = response.needsAdmin || false;
        responseOptions = response.options || null;
      } else {
        botResponse = response;
      }

      if (userImages.length > 0) {
        botResponse += `\n\nThank you for the images. A property manager will review them and get back to you with relevant information.`;
      }

      addBotMessage(botResponse, responseOptions);

      conversationHistory.push({
        role: "bot",
        message: botResponse,
        timestamp: new Date().toISOString(),
      });

      if (
        !adminConnected &&
        (needsAdmin ||
          messagesSinceLastAdminOffer >= MESSAGES_BEFORE_ADMIN_OFFER)
      ) {
        if (!document.getElementById("adminConnectOption")) {
          setTimeout(() => {
            showAdminConnectOption();
            messagesSinceLastAdminOffer = 0;
          }, 800);
        }
      }

      sendBtn.disabled = false;
      chatInput.focus();
    }, delay);
  }

  sendBtn.addEventListener("click", () => sendMessage());

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
