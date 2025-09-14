class ChatApp {
    constructor() {
        this.config = {
            apiEndpoint: '',
            apiKey: '',
            selectedModel: ''
        };
        
        this.metrics = {
            totalTokens: 0,
            messagesCount: 0,
            responseTimes: [],
            totalResponseTime: 0
        };
        
        this.messages = [];
        this.isTyping = false;
        this.currentStreamingMessage = null;
        
        this.initializeElements();
        this.loadConfiguration();
        this.attachEventListeners();
        this.updateUI();
        this.initializeMarkdown();
        this.initializeSidebar();
    }
    
    initializeMarkdown() {
        // Configure marked for markdown parsing
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
        }
        
        // Initialize Mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                deterministicIds: true,
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: false
                },
                themeVariables: {
                    primaryColor: '#10A37F',
                    primaryTextColor: '#202123',
                    primaryBorderColor: '#E5E5E5',
                    lineColor: '#8E8EA0'
                }
            });
        }
    }
    
    initializeElements() {
        // Configuration elements
        this.apiEndpointInput = document.getElementById('api-endpoint');
        this.apiKeyInput = document.getElementById('api-key');
        this.modelSelect = document.getElementById('model-select');
        this.refreshModelsBtn = document.getElementById('refresh-models');
        this.saveConfigBtn = document.getElementById('save-config');
        
        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.toggleSidebarBtn = document.getElementById('toggle-sidebar');
        this.closeSidebarBtn = document.getElementById('close-sidebar');
        this.sidebarBackdrop = document.getElementById('sidebar-backdrop');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.modelInfo = document.getElementById('model-info');
        
        // Status and metrics
        this.connectionStatus = document.getElementById('connection-status');
        this.statusText = document.getElementById('status-text');
        this.totalTokensSpan = document.getElementById('total-tokens');
        this.messagesCountSpan = document.getElementById('messages-count');
        this.avgResponseTimeSpan = document.getElementById('avg-response-time');
        this.throughputSpan = document.getElementById('throughput');
        
        // Overlays
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.toastContainer = document.getElementById('toast-container');
    }
    
    loadConfiguration() {
        const savedConfig = localStorage.getItem('chatapp-config');
        if (savedConfig) {
            try {
                this.config = JSON.parse(savedConfig);
                this.apiEndpointInput.value = this.config.apiEndpoint || 'https://api.openai.com/v1';
                this.apiKeyInput.value = this.config.apiKey || '';
                if (this.config.selectedModel) {
                    this.addModelOption(this.config.selectedModel);
                    this.modelSelect.value = this.config.selectedModel;
                }
            } catch (error) {
                console.error('Error loading configuration:', error);
                this.showToast('Error loading saved configuration', 'error');
            }
        }
    }
    
    saveConfiguration() {
        this.config.apiEndpoint = this.apiEndpointInput.value.trim();
        this.config.apiKey = this.apiKeyInput.value.trim();
        this.config.selectedModel = this.modelSelect.value;
        
        if (!this.config.apiEndpoint || !this.config.apiKey) {
            this.showToast('Please provide both API endpoint and API key', 'error');
            return false;
        }
        
        try {
            localStorage.setItem('chatapp-config', JSON.stringify(this.config));
            this.showToast('Configuration saved successfully', 'success');
            this.updateConnectionStatus('connected');
            this.updateUI();
            return true;
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showToast('Error saving configuration', 'error');
            return false;
        }
    }
    
    attachEventListeners() {
        // Configuration events
        this.saveConfigBtn.addEventListener('click', () => {
            if (this.saveConfiguration()) {
                this.refreshModels();
            }
        });
        
        this.refreshModelsBtn.addEventListener('click', () => {
            this.refreshModels();
        });
        
        this.modelSelect.addEventListener('change', () => {
            this.config.selectedModel = this.modelSelect.value;
            this.saveConfiguration();
            this.updateModelInfo();
        });
        
        // Chat events
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.chatInput.addEventListener('input', () => {
            this.autoResizeTextarea();
            this.updateUI();
        });
        
        this.clearChatBtn.addEventListener('click', () => {
            this.clearChat();
        });
        
        // Debug the toggle button
        console.log('Toggle sidebar button:', this.toggleSidebarBtn);
        console.log('Element exists:', document.getElementById('toggle-sidebar') !== null);
        
        if (this.toggleSidebarBtn) {
            this.toggleSidebarBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        } else {
            console.log('Toggle sidebar button not found');
            // Try to find it again
            setTimeout(() => {
                this.toggleSidebarBtn = document.getElementById('toggle-sidebar');
                if (this.toggleSidebarBtn) {
                    this.toggleSidebarBtn.addEventListener('click', () => {
                        this.toggleSidebar();
                    });
                    console.log('Toggle button found on retry');
                }
            }, 100);
        }

        // Close sidebar button
        if (this.closeSidebarBtn) {
            this.closeSidebarBtn.addEventListener('click', () => {
                this.closeSidebar();
            });
        }
        
        // Add backdrop click listener
        if (this.sidebarBackdrop) {
            this.sidebarBackdrop.addEventListener('click', () => {
                this.closeSidebar();
            });
        }
        
        // Auto-save config on input changes
        [this.apiEndpointInput, this.apiKeyInput].forEach(input => {
            input.addEventListener('change', () => {
                this.config.apiEndpoint = this.apiEndpointInput.value.trim();
                this.config.apiKey = this.apiKeyInput.value.trim();
                if (this.config.apiEndpoint && this.config.apiKey) {
                    localStorage.setItem('chatapp-config', JSON.stringify(this.config));
                }
            });
        });
    }
    
    updateUI() {
        const hasValidConfig = this.config.apiEndpoint && this.config.apiKey;
        
        // Enable/disable model controls
        this.modelSelect.disabled = !hasValidConfig;
        this.refreshModelsBtn.disabled = !hasValidConfig;
        
        // Enable/disable chat input
        const canChat = hasValidConfig && this.config.selectedModel && !this.isTyping;
        this.chatInput.disabled = !canChat;
        this.sendButton.disabled = !canChat || !this.chatInput.value.trim();
        
        // Update model info
        this.updateModelInfo();
        
        // Update connection status
        if (hasValidConfig) {
            this.updateConnectionStatus('connected');
        } else {
            this.updateConnectionStatus('disconnected');
        }
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus.className = `status-dot status-${status}`;
        
        switch (status) {
            case 'connected':
                this.statusText.textContent = 'Connected';
                break;
            case 'disconnected':
                this.statusText.textContent = 'Not Connected';
                break;
            case 'error':
                this.statusText.textContent = 'Connection Error';
                break;
        }
    }
    
    updateModelInfo() {
        if (this.config.selectedModel) {
            this.modelInfo.textContent = `Model: ${this.config.selectedModel}`;
        } else {
            this.modelInfo.textContent = 'No model selected';
        }
    }
    
    async refreshModels() {
        if (!this.config.apiEndpoint || !this.config.apiKey) {
            this.showToast('Please configure API endpoint and key first', 'warning');
            return;
        }
        
        this.showLoading('Loading models...');
        this.refreshModelsBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.config.apiEndpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid response format: expected models array');
            }
            
            this.populateModels(data.data);
            this.showToast('Models loaded successfully', 'success');
            this.updateConnectionStatus('connected');
            
        } catch (error) {
            console.error('Error fetching models:', error);
            this.showToast(`Failed to load models: ${error.message}`, 'error');
            this.updateConnectionStatus('error');
        } finally {
            this.hideLoading();
            this.refreshModelsBtn.disabled = false;
            this.updateUI();
        }
    }
    
    populateModels(models) {
        // Clear existing options except the first one
        this.modelSelect.innerHTML = '<option value="">Select a model...</option>';
        
        // Sort models by ID and add to select
        models
            .filter(model => model.id)
            .sort((a, b) => a.id.localeCompare(b.id))
            .forEach(model => {
                this.addModelOption(model.id);
            });
        
        // Restore selected model if it exists
        if (this.config.selectedModel && models.find(m => m.id === this.config.selectedModel)) {
            this.modelSelect.value = this.config.selectedModel;
        } else if (models.length > 0) {
            // Auto-select first model if none selected
            this.modelSelect.value = models[0].id;
            this.config.selectedModel = models[0].id;
            this.saveConfiguration();
        }
    }
    
    addModelOption(modelId) {
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = modelId;
        this.modelSelect.appendChild(option);
    }
    
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;
        
        if (!this.config.selectedModel) {
            this.showToast('Please select a model first', 'warning');
            return;
        }
        
        // Add user message
        this.addMessage('user', message);
        this.chatInput.value = '';
        this.autoResizeTextarea();
        
        // Update metrics
        this.metrics.messagesCount++;
        this.updateMetrics();
        
        // Show typing indicator
        this.setTyping(true);
        
        const startTime = Date.now();
        
        try {
            await this.callAPIStreaming(message, startTime);
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('assistant', `Error: ${error.message}`, { 
                isError: true,
                responseTime: Date.now() - startTime
            });
            this.showToast(`API Error: ${error.message}`, 'error');
        } finally {
            this.setTyping(false);
        }
    }
    
    async callAPIStreaming(message, startTime) {
        const messages = [
            ...this.messages
                .filter(msg => msg.role !== 'system')
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
            { role: 'user', content: message }
        ];
        
        const requestBody = {
            model: this.config.selectedModel,
            messages: messages,
            max_tokens: 1000,
            temperature: 0.7,
            stream: true
        };
        
        const response = await fetch(`${this.config.apiEndpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorData}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let fullContent = '';
        let totalTokens = 0;
        let thinkingContent = '';
        let isInThinking = false;
        let buffer = '';
        let promptTokens = 0;
        let completionTokens = 0;
        
        // Create streaming message
        this.currentStreamingMessage = this.addStreamingMessage('assistant');
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            
                            if (delta?.content) {
                                const chunk = delta.content;
                                
                                // Handle thinking tags
                                for (let i = 0; i < chunk.length; i++) {
                                    const char = chunk[i];
                                    
                                    if (!isInThinking && chunk.slice(i).startsWith('<think>')) {
                                        isInThinking = true;
                                        i += 6; // Skip '<think>'
                                        continue;
                                    }
                                    
                                    if (isInThinking && chunk.slice(i).startsWith('</think>')) {
                                        isInThinking = false;
                                        i += 7; // Skip '</think>'
                                        continue;
                                    }
                                    
                                    if (isInThinking) {
                                        thinkingContent += char;
                                    } else {
                                        fullContent += char;
                                        this.updateStreamingMessage(fullContent, thinkingContent);
                                    }
                                }
                            }
                            
                            if (parsed.usage) {
                                totalTokens = parsed.usage.total_tokens || 0;
                                promptTokens = parsed.usage.prompt_tokens || 0;
                                completionTokens = parsed.usage.completion_tokens || 0;
                            }
                            
                            // Some APIs send usage in finish_reason or at the end
                            if (parsed.choices?.[0]?.finish_reason === 'stop' && parsed.usage) {
                                totalTokens = parsed.usage.total_tokens || totalTokens;
                                promptTokens = parsed.usage.prompt_tokens || promptTokens;
                                completionTokens = parsed.usage.completion_tokens || completionTokens;
                            }
                        } catch (e) {
                            console.warn('Failed to parse streaming chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Update response time metrics
        this.metrics.responseTimes.push(responseTime);
        this.metrics.totalResponseTime += responseTime;
        this.metrics.totalTokens += totalTokens;
        this.updateMetrics();
        
        // If no tokens were received from usage, estimate based on content
        if (totalTokens === 0) {
            // Rough estimation: ~4 characters per token for English text
            const estimatedTokens = Math.ceil((fullContent.length + thinkingContent.length) / 4);
            totalTokens = estimatedTokens;
            // Update metrics here too since totalTokens was calculated
            this.metrics.totalTokens += totalTokens;
            this.updateMetrics();
        }
        
        // Finalize the streaming message
        this.finalizeStreamingMessage(fullContent, thinkingContent, {
            tokens: totalTokens,
            responseTime: responseTime,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            model: this.config.selectedModel
        });
    }
    
    addMessage(role, content, meta = {}) {
        const message = {
            role,
            content,
            timestamp: new Date(),
            ...meta
        };
        
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }
    
    addStreamingMessage(role) {
        const message = {
            role,
            content: '',
            timestamp: new Date(),
            isStreaming: true
        };
        
        this.messages.push(message);
        const messageElement = this.renderMessage(message);
        this.scrollToBottom();
        return messageElement;
    }
    
    updateStreamingMessage(content, thinkingContent = '') {
        if (!this.currentStreamingMessage) return;
        
        const messageText = this.currentStreamingMessage.querySelector('.message-text');
        if (messageText) {
            // Process thinking content
            let processedContent = content;
            if (thinkingContent) {
                const thinkingSection = this.createThinkingSection(thinkingContent);
                messageText.innerHTML = thinkingSection + this.parseMarkdown(processedContent) + '<span class="streaming-cursor"></span>';
            } else {
                messageText.innerHTML = this.parseMarkdown(processedContent) + '<span class="streaming-cursor"></span>';
            }
            
            // Don't render Mermaid during streaming to avoid syntax errors
            // It will be rendered when streaming is complete
        }
        
        this.scrollToBottom();
    }
    
    finalizeStreamingMessage(content, thinkingContent = '', meta = {}) {
        if (!this.currentStreamingMessage) return;
        
        // Update the message in our messages array
        const messageIndex = this.messages.length - 1;
        if (messageIndex >= 0) {
            this.messages[messageIndex] = {
                ...this.messages[messageIndex],
                content,
                thinkingContent,
                isStreaming: false,
                ...meta
            };
        }
        
        // Update the DOM element
        const messageText = this.currentStreamingMessage.querySelector('.message-text');
        if (messageText) {
            let finalContent = content;
            if (thinkingContent) {
                const thinkingSection = this.createThinkingSection(thinkingContent);
                messageText.innerHTML = thinkingSection + this.parseMarkdown(finalContent);
            } else {
                messageText.innerHTML = this.parseMarkdown(finalContent);
            }
            
            // Now render mermaid diagrams since streaming is complete
            this.renderMermaidDiagrams(messageText);
        }
        
        // Update metadata
        this.updateMessageMeta(this.currentStreamingMessage, meta);
        
        this.currentStreamingMessage = null;
        this.scrollToBottom();
    }
    
    renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.role === 'user' ? 'U' : 'AI';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const text = document.createElement('div');
        text.className = 'message-text';
        
        // Handle thinking content for reasoning models
        if (message.thinkingContent) {
            const thinkingSection = this.createThinkingSection(message.thinkingContent);
            text.innerHTML = thinkingSection + this.parseMarkdown(message.content);
        } else {
            text.innerHTML = this.parseMarkdown(message.content);
        }
        
        // Add streaming cursor if streaming
        if (message.isStreaming) {
            text.innerHTML += '<span class="streaming-cursor"></span>';
        }
        
        if (message.isError) {
            text.style.color = 'var(--error-color)';
        }
        
        // Only render mermaid diagrams if not streaming
        if (!message.isStreaming) {
            this.renderMermaidDiagrams(text);
        }
        
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        
        this.updateMessageMeta(messageDiv, message, meta);
        
        content.appendChild(text);
        content.appendChild(meta);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        // Remove welcome message if it exists
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        this.chatMessages.appendChild(messageDiv);
        return messageDiv;
    }
    
    updateMessageMeta(messageDiv, message, meta = null) {
        if (!meta) {
            meta = messageDiv.querySelector('.message-meta');
        }
        
        if (!meta) return;
        
        meta.innerHTML = '';
        
        // Add timestamp - fix undefined timestamp error
        const timestamp = document.createElement('span');
        timestamp.className = 'meta-item';
        const messageTime = message.timestamp || new Date();
        timestamp.textContent = messageTime.toLocaleTimeString();
        meta.appendChild(timestamp);
        
        // Add model name for AI responses
        if (message.role === 'assistant' && message.model) {
            const model = document.createElement('span');
            model.className = 'meta-item';
            model.textContent = message.model;
            meta.appendChild(model);
        }
        
        // Add tokens if available
        if (message.tokens !== undefined) {
            const tokens = document.createElement('span');
            tokens.className = 'meta-item';
            tokens.textContent = `${message.tokens} tokens`;
            meta.appendChild(tokens);
        }
        
        // Add response time if available
        if (message.responseTime !== undefined) {
            const responseTime = document.createElement('span');
            responseTime.className = 'meta-item';
            responseTime.textContent = `${message.responseTime}ms`;
            meta.appendChild(responseTime);
            
            // Add tokens per second if both response time and tokens are available
            if (message.tokens !== undefined && message.responseTime > 0) {
                const tokensPerSec = Math.round((message.tokens * 1000) / message.responseTime);
                const tokensPerSecSpan = document.createElement('span');
                tokensPerSecSpan.className = 'meta-item';
                tokensPerSecSpan.textContent = `${tokensPerSec} tokens/sec`;
                meta.appendChild(tokensPerSecSpan);
            }
        }
    }
    
    createThinkingSection(thinkingContent) {
        const thinkingId = 'thinking-' + Date.now() + Math.random().toString(36).substr(2, 9);
        return `
            <div class="thinking-section">
                <div class="thinking-header" onclick="this.parentElement.classList.toggle('expanded'); this.parentElement.querySelector('.thinking-content').classList.toggle('expanded'); this.querySelector('.thinking-toggle').classList.toggle('expanded');">
                    <span class="thinking-toggle">▶</span>
                    <span>Reasoning Process</span>
                </div>
                <div class="thinking-content" id="${thinkingId}">${this.escapeHtml(thinkingContent)}</div>
            </div>
        `;
    }
    
    parseMarkdown(content) {
        if (!content) return '';
        
        // If marked is available, use it for markdown parsing
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(content);
            } catch (error) {
                console.warn('Markdown parsing failed:', error);
                return this.escapeHtml(content);
            }
        }
        
        // Fallback: simple markdown-like parsing
        return this.simpleMarkdownParse(content);
    }
    
    simpleMarkdownParse(content) {
        return this.escapeHtml(content)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    renderMermaidDiagrams(container) {
        if (typeof mermaid === 'undefined') return;
        
        const mermaidElements = container.querySelectorAll('code.language-mermaid, .language-mermaid, pre code.language-mermaid');
        mermaidElements.forEach((element, index) => {
            let code = element.textContent.trim();
            const id = `mermaid-${Date.now()}-${index}`;
            
            // Clean up the code by removing HTML entities and fixing common issues
            code = code
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            
            // Try to fix common Mermaid syntax issues with parentheses in labels
            code = code.replace(/\[([^\]]*)\(([^)]*)\)([^\]]*)\]/g, '[\"$1($2)$3\"]');
            
            console.log('Attempting to render Mermaid diagram:', code.substring(0, 100) + '...');
            
            try {
                mermaid.render(id, code).then(({ svg }) => {
                    console.log('Mermaid render success for:', id);
                    const wrapper = document.createElement('div');
                    wrapper.className = 'mermaid';
                    wrapper.innerHTML = svg;
                    
                    // Replace the parent pre element if it exists, otherwise replace the code element
                    const targetElement = element.tagName === 'CODE' && element.parentNode.tagName === 'PRE' 
                        ? element.parentNode 
                        : element;
                    targetElement.parentNode.replaceChild(wrapper, targetElement);
                }).catch(error => {
                    console.error('Mermaid rendering failed:', error);
                    this.fallbackToCodeBlock(element, code);
                });
            } catch (error) {
                console.error('Mermaid rendering failed:', error);
                this.fallbackToCodeBlock(element, code);
            }
        });
    }
    
    fallbackToCodeBlock(element, code) {
        // Create a collapsible error section similar to thinking
        const errorId = 'mermaid-error-' + Date.now() + Math.random().toString(36).substr(2, 9);
        const errorSection = document.createElement('div');
        errorSection.className = 'thinking-section';
        errorSection.innerHTML = `
            <div class="thinking-header" onclick="this.parentElement.classList.toggle('expanded'); this.parentElement.querySelector('.thinking-content').classList.toggle('expanded'); this.querySelector('.thinking-toggle').classList.toggle('expanded');">
                <span class="thinking-toggle">▶</span>
                <span style="color: var(--error-color);">Mermaid Syntax Error</span>
            </div>
            <div class="thinking-content" id="${errorId}">
                <div style="color: var(--error-color); margin-bottom: 8px; font-size: 11px;">
                    The diagram syntax contains errors. Raw code:
                </div>
                <pre style="margin: 0; background: none; padding: 0;"><code>${this.escapeHtml(code)}</code></pre>
            </div>
        `;
        
        element.parentNode.replaceChild(errorSection, element);
    }
    
    setTyping(isTyping) {
        this.isTyping = isTyping;
        this.typingIndicator.style.display = isTyping ? 'block' : 'none';
        this.updateUI();
    }
    
    updateMetrics() {
        this.totalTokensSpan.textContent = this.metrics.totalTokens.toLocaleString();
        this.messagesCountSpan.textContent = this.metrics.messagesCount.toString();
        
        if (this.metrics.responseTimes.length > 0) {
            const avgResponseTime = Math.round(
                this.metrics.totalResponseTime / this.metrics.responseTimes.length
            );
            this.avgResponseTimeSpan.textContent = `${avgResponseTime} ms`;
            
            // Calculate throughput (tokens per second)
            const totalTimeInSeconds = this.metrics.totalResponseTime / 1000;
            const throughput = totalTimeInSeconds > 0 ? 
                Math.round(this.metrics.totalTokens / totalTimeInSeconds) : 0;
            this.throughputSpan.textContent = throughput.toString();
        }
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.messages = [];
            this.chatMessages.innerHTML = `
                <div class="welcome-message">
                    <h3>Welcome to AI Chat Assistant</h3>
                    <p>Configure your API settings in the sidebar to start chatting.</p>
                </div>
            `;
            
            // Reset metrics
            this.metrics = {
                totalTokens: 0,
                messagesCount: 0,
                responseTimes: [],
                totalResponseTime: 0
            };
            this.updateMetrics();
            
            this.showToast('Chat history cleared', 'success');
        }
    }
    
    autoResizeTextarea() {
        this.chatInput.style.height = '60px'; // Reset to default 3-line height
        const newHeight = Math.max(60, Math.min(this.chatInput.scrollHeight, 120));
        this.chatInput.style.height = newHeight + 'px';
        
        // Update send button state
        this.sendButton.disabled = !this.chatInput.value.trim() || 
                                  !this.config.selectedModel || 
                                  this.isTyping;
    }
    
    initializeSidebar() {
        const sidebar = document.querySelector('.config-sidebar');
        const appContainer = document.querySelector('.app-container');
        
        // Track the initial screen state to handle resize intelligently
        this.lastKnownWidth = window.innerWidth;
        this.isMobileView = window.innerWidth <= 768;
        
        // Hide sidebar on mobile by default
        if (this.isMobileView) {
            this.closeSidebar();
        }
        
        // Handle window resize - only auto-close sidebar when transitioning to mobile
        window.addEventListener('resize', () => {
            const currentWidth = window.innerWidth;
            const wasDesktop = this.lastKnownWidth > 768;
            const isNowMobile = currentWidth <= 768;
            
            if (wasDesktop && isNowMobile) {
                // Transitioning from desktop to mobile - auto-close sidebar
                this.closeSidebar();
                this.isMobileView = true;
            } else if (!wasDesktop && currentWidth > 768) {
                // Transitioning from mobile to desktop - show sidebar
                sidebar.classList.remove('hidden');
                appContainer.classList.remove('sidebar-hidden');
                if (this.sidebarBackdrop) {
                    this.sidebarBackdrop.style.display = 'none';
                }
                this.isMobileView = false;
            }
            // For mobile-to-mobile resizes (like keyboard opening), don't auto-close
            
            this.lastKnownWidth = currentWidth;
        });
    }
    
    toggleSidebar() {
        const sidebar = document.querySelector('.config-sidebar');
        const appContainer = document.querySelector('.app-container');
        
        if (sidebar.classList.contains('hidden')) {
            this.openSidebar();
        } else {
            this.closeSidebar();
        }
    }
    
    openSidebar() {
        const sidebar = document.querySelector('.config-sidebar');
        const appContainer = document.querySelector('.app-container');
        
        sidebar.classList.remove('hidden');
        appContainer.classList.remove('sidebar-hidden');
        
        // Show backdrop on mobile
        if (window.innerWidth <= 768 && this.sidebarBackdrop) {
            this.sidebarBackdrop.style.display = 'block';
        }
    }
    
    closeSidebar() {
        const sidebar = document.querySelector('.config-sidebar');
        const appContainer = document.querySelector('.app-container');
        
        sidebar.classList.add('hidden');
        appContainer.classList.add('sidebar-hidden');
        
        // Hide backdrop
        if (this.sidebarBackdrop) {
            this.sidebarBackdrop.style.display = 'none';
        }
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
    
    showLoading(message = 'Loading...') {
        this.loadingOverlay.querySelector('p').textContent = message;
        this.loadingOverlay.style.display = 'flex';
    }
    
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
    
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // Auto-remove toast after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Remove on click
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});

// Handle textarea auto-resize on page load
window.addEventListener('load', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    }
});
