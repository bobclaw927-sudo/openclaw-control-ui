// Gateway WebSocket client with proper RPC handling

export interface RPCRequest {
  type: 'req';
  id: string;
  method: string;
  params: any;
}

export interface RPCResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: string;
}

export interface GatewayEvent {
  type: 'event';
  event: string;
  payload?: any;
  seq?: number;
  stateVersion?: number;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  private eventHandlers: Map<string, Set<(payload: any) => void>> = new Map();
  private messageHandler: ((type: string, text: string) => void) | null = null;
  
  constructor(
    private url: string,
    private token: string,
    private onStatusChange: (connected: boolean, version?: string) => void
  ) {}
  
  setMessageHandler(handler: (type: string, text: string) => void) {
    this.messageHandler = handler;
  }
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('info', '🔌 Connecting to OpenClaw Gateway...');
      
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.log('info', '✅ WebSocket connected');
        this.sendConnect()
          .then(() => resolve())
          .catch(reject);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        this.log('error', '❌ WebSocket error');
        this.onStatusChange(false);
        reject(error);
      };
      
      this.ws.onclose = () => {
        this.log('info', '🔌 Disconnected from Gateway');
        this.onStatusChange(false);
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.connect().catch(console.error);
        }, 5000);
      };
    });
  }
  
  private async sendConnect(): Promise<void> {
    const response = await this.sendRPC('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'control-ui',
        version: '1.0.0',
        platform: 'web',
        mode: 'operator'
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      auth: { token: this.token },
      locale: 'en-US',
      userAgent: 'openclaw-control-ui/1.0.0'
    });
    
    if (response.type === 'hello-ok') {
      this.log('info', '✅ Connected to OpenClaw Gateway');
      this.onStatusChange(true, response.version);
    } else {
      throw new Error('Invalid hello response');
    }
  }
  
  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'res') {
        this.handleResponse(msg as RPCResponse);
      } else if (msg.type === 'event') {
        this.handleEvent(msg as GatewayEvent);
      } else if (msg.type === 'event' && msg.event === 'connect.challenge') {
        // Ignore challenge, we'll send connect after open
      }
    } catch (err) {
      this.log('error', `Failed to parse message: ${err}`);
    }
  }
  
  private handleResponse(msg: RPCResponse) {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;
    
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(msg.id);
    
    if (msg.ok) {
      pending.resolve(msg.payload);
    } else {
      pending.reject(new Error(msg.error || 'RPC failed'));
      this.log('error', `❌ RPC Error: ${msg.error || 'Unknown'}`);
    }
  }
  
  private handleEvent(msg: GatewayEvent) {
    this.log('info', `📡 Event: ${msg.event}`);
    
    const handlers = this.eventHandlers.get(msg.event);
    if (handlers) {
      handlers.forEach(handler => handler(msg.payload));
    }
    
    // Wildcard handlers
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler({ event: msg.event, ...msg.payload }));
    }
  }
  
  sendRPC(method: string, params: any = {}, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to Gateway'));
        return;
      }
      
      const id = `${method}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      const request: RPCRequest = {
        type: 'req',
        id,
        method,
        params
      };
      
      this.ws.send(JSON.stringify(request));
      this.log('info', `📤 Sent: ${method}`);
    });
  }
  
  on(event: string, handler: (payload: any) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }
  
  off(event: string, handler: (payload: any) => void) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  private log(type: string, text: string) {
    if (this.messageHandler) {
      this.messageHandler(type, text);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Disconnected'));
    });
    this.pendingRequests.clear();
  }
}
