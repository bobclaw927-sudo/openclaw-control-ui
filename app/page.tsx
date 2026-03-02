'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  MessageSquare, 
  Settings, 
  Terminal,
  Zap,
  Users,
  BarChart3,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Filter
} from 'lucide-react';
import { SessionDetail } from './components/SessionDetail';

interface Session {
  key: string;
  model: string;
  contextTokens: number;
  totalTokens: number;
  updatedAt: number;
  displayName?: string;
}

interface GatewayStatus {
  connected: boolean;
  version: string;
  uptime: number;
  lastPing?: number;
}

interface ConsoleMessage {
  id: string;
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
  timestamp: number;
}

type ViewType = 'dashboard' | 'sessions' | 'agents' | 'analytics' | 'settings' | 'console';

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

const MAX_CONSOLE_MESSAGES = 500;

export default function ControlUI() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<GatewayStatus>({
    connected: false,
    version: '',
    uptime: 0
  });
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [command, setCommand] = useState('');
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const wsRef = useRef<WebSocket | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filter sessions based on search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredSessions(sessions);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = sessions.filter(s => 
      s.key.toLowerCase().includes(query) ||
      s.model.toLowerCase().includes(query) ||
      s.displayName?.toLowerCase().includes(query)
    );
    setFilteredSessions(filtered);
  }, [searchQuery, sessions]);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleMessages]);

  const addConsoleMessage = (type: ConsoleMessage['type'], text: string) => {
    const msg: ConsoleMessage = {
      id: Date.now().toString() + Math.random(),
      type,
      text,
      timestamp: Date.now()
    };
    setConsoleMessages(prev => {
      const updated = [...prev, msg];
      return updated.slice(-MAX_CONSOLE_MESSAGES); // Keep last 500 messages
    });
  };

  // Connect to OpenClaw Gateway WebSocket
  useEffect(() => {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:18789';
    const gatewayToken = process.env.NEXT_PUBLIC_GATEWAY_TOKEN || '';

    const connect = () => {
      setConnectionState(ConnectionState.CONNECTING);
      addConsoleMessage('info', '🔌 Connecting to OpenClaw Gateway...');
      const ws = new WebSocket(gatewayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState(ConnectionState.CONNECTED);
        console.log('Connected to OpenClaw Gateway');
        
        const connectMsg = {
          type: 'req',
          id: 'connect-' + Date.now(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'openclaw-control-ui',
              version: '1.0.0',
              platform: 'web',
              mode: 'ui'
            },
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            auth: { token: gatewayToken },
            locale: 'en-US',
            userAgent: 'openclaw-control-ui/1.0.0'
          }
        };
        
        ws.send(JSON.stringify(connectMsg));
        setStatus(prev => ({ ...prev, connected: true, lastPing: Date.now() }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('Received:', msg);

          if (msg.type === 'res') {
            if (msg.ok && msg.payload?.type === 'hello-ok') {
              addConsoleMessage('info', '✅ Connected to OpenClaw Gateway');
              setStatus(prev => ({ 
                ...prev, 
                connected: true,
                version: msg.payload.version || 'unknown'
              }));
              fetchSessions();
            } else if (msg.id?.startsWith('sessions-')) {
              // Handle sessions.list response
              if (msg.ok && msg.payload?.sessions) {
                const sessions = msg.payload.sessions.map((s: any) => ({
                  key: s.key,
                  model: s.model || 'unknown',
                  contextTokens: s.tokens || 0,
                  totalTokens: s.maxTokens || 200000,
                  updatedAt: s.lastActivity || Date.now(),
                  displayName: s.displayName || s.key.split(':').pop()
                }));
                setSessions(sessions);
                setLastRefresh(Date.now());
                setIsLoading(false);
                addConsoleMessage('info', `✅ Sessions loaded (${sessions.length} active)`);
              } else {
                addConsoleMessage('error', `❌ Failed to load sessions: ${msg.error || msg.errorMessage || 'Unknown error'}`);
                setIsLoading(false);
              }
            } else if (!msg.ok) {
              addConsoleMessage('error', `❌ RPC Error [${msg.errorCode || 'UNKNOWN'}]: ${msg.errorMessage || msg.error || 'Unknown error'}`);
            } else {
              addConsoleMessage('output', JSON.stringify(msg.payload, null, 2));
            }
          }

          if (msg.type === 'event') {
            addConsoleMessage('info', `📡 Event: ${msg.event}`);
            if (msg.event.includes('session') && autoRefresh) {
              fetchSessions();
            }
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
          addConsoleMessage('error', `Parse error: ${err}`);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState(ConnectionState.ERROR);
        addConsoleMessage('error', '❌ WebSocket connection error - check gateway status');
        setStatus(prev => ({ ...prev, connected: false }));
      };

      ws.onclose = (event) => {
        const wasConnected = connectionState === ConnectionState.CONNECTED;
        console.log('Disconnected from Gateway', event.code, event.reason);
        
        if (wasConnected) {
          setConnectionState(ConnectionState.RECONNECTING);
          addConsoleMessage('info', `🔌 Disconnected from Gateway (code: ${event.code}) - reconnecting in 5s...`);
        } else {
          setConnectionState(ConnectionState.DISCONNECTED);
          addConsoleMessage('info', '🔌 Connection closed - retrying in 5s...');
        }
        
        setStatus(prev => ({ ...prev, connected: false }));
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => wsRef.current?.close();
  }, [autoRefresh]);

  // Auto-refresh sessions
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (status.connected) fetchSessions();
    }, 30000);
    return () => clearInterval(interval);
  }, [status.connected, autoRefresh]);

  const fetchSessions = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addConsoleMessage('error', '❌ Not connected to Gateway');
      return;
    }

    setIsLoading(true);
    addConsoleMessage('info', '📊 Fetching sessions...');
    
    try {
      const rpcId = 'sessions-' + Date.now();
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: rpcId,
        method: 'sessions.list',
        params: { limit: 50 }
      }));
      
      // Response handled in ws.onmessage handler
      
    } catch (err) {
      addConsoleMessage('error', `❌ Failed to fetch sessions: ${err}`);
      setIsLoading(false);
    }
  };

  const sendCommand = async () => {
    if (!command.trim()) return;

    const trimmedCommand = command.trim();
    addConsoleMessage('input', `> ${trimmedCommand}`);
    setCommandHistory(prev => [...prev, trimmedCommand]);
    setHistoryIndex(-1);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const rpcId = 'cmd-' + Date.now();
        let method = 'exec';
        let params: any = { command: trimmedCommand };
        
        if (trimmedCommand.startsWith('sessions.')) {
          method = trimmedCommand.split(' ')[0];
          params = {};
        }
        
        wsRef.current.send(JSON.stringify({
          type: 'req',
          id: rpcId,
          method: method,
          params: params
        }));
        
        addConsoleMessage('info', `📤 Sent: ${method}`);
      } catch (err) {
        addConsoleMessage('error', `❌ Send error: ${err}`);
      }
    } else {
      addConsoleMessage('error', '❌ Not connected to Gateway');
    }

    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        if (newIndex === commandHistory.length - 1 && historyIndex === commandHistory.length - 1) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  const formatTimestamp = (ts: number) => new Date(ts).toLocaleTimeString();

  const getMessageIcon = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'error': return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
      case 'info': return <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />;
      case 'output': return <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />;
      default: return <Terminal className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }
  };

  const getMessageColor = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'info': return 'text-blue-400';
      case 'output': return 'text-green-400';
      case 'input': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Active Sessions</p>
                    <p className="text-3xl font-bold mt-2">{sessions.length}</p>
                  </div>
                  <MessageSquare className="w-12 h-12 text-blue-400 opacity-50" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Tokens</p>
                    <p className="text-3xl font-bold mt-2">
                      {sessions.reduce((acc, s) => acc + s.contextTokens, 0).toLocaleString()}
                    </p>
                  </div>
                  <BarChart3 className="w-12 h-12 text-green-400 opacity-50" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Gateway Status</p>
                    <p className="text-3xl font-bold mt-2">{status.connected ? 'Online' : 'Offline'}</p>
                    {status.version && (
                      <p className="text-xs text-gray-500 mt-1">v{status.version}</p>
                    )}
                  </div>
                  <Activity className={`w-12 h-12 ${status.connected ? 'text-green-400' : 'text-red-400'} opacity-50`} />
                </div>
              </div>
            </div>

            {/* Sessions List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Active Sessions</h2>
                <div className="flex items-center space-x-4">
                  {isLoading && <span className="text-sm text-gray-400">Loading...</span>}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-700">
                {filteredSessions.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{searchQuery ? 'No sessions match your search' : 'No active sessions'}</p>
                    <p className="text-sm mt-1">Sessions will appear here once connected</p>
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <div 
                      key={session.key}
                      className="px-6 py-4 hover:bg-gray-750 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedSession(session);
                        setShowSessionDetail(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {session.displayName && (
                            <p className="text-sm font-semibold text-blue-300 mb-1">{session.displayName}</p>
                          )}
                          <p className="font-mono text-xs text-gray-400">{session.key}</p>
                          <p className="text-sm text-gray-400 mt-1">{session.model}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {session.contextTokens.toLocaleString()} / {session.totalTokens.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {Math.round((session.contextTokens / session.totalTokens) * 100)}% used
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimestamp(session.updatedAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-3 bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            (session.contextTokens / session.totalTokens) > 0.8 ? 'bg-red-500' :
                            (session.contextTokens / session.totalTokens) > 0.5 ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${(session.contextTokens / session.totalTokens) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        );

      case 'console':
        return (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold flex items-center space-x-2">
                <Terminal className="w-5 h-5" />
                <span>Console</span>
                <span className="text-xs text-gray-500">({consoleMessages.length} messages)</span>
              </h2>
            </div>
            
            <div className="p-4">
              <div 
                ref={consoleRef}
                className="bg-black rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm space-y-1"
              >
                {consoleMessages.map((msg) => (
                  <div key={msg.id} className="flex items-start space-x-2">
                    {getMessageIcon(msg.type)}
                    <span className="text-gray-500 text-xs w-20 flex-shrink-0">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                    <span className={`flex-1 ${getMessageColor(msg.type)} break-all`}>
                      {msg.text}
                    </span>
                  </div>
                ))}
                {consoleMessages.length === 0 && (
                  <div className="text-gray-500 text-center py-8">
                    Console output will appear here...
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex space-x-2">
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter command (↑↓ for history)..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <button
                  onClick={sendCommand}
                  disabled={!command.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Try: <code className="bg-gray-700 px-2 py-1 rounded">sessions.list</code> or any RPC method
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <p className="text-2xl font-semibold mb-2">{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</p>
            <p className="text-gray-400">This view is coming soon...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Zap className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold">OpenClaw Control UI</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Last refresh: {formatTimestamp(lastRefresh)}</span>
            </div>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Auto-refresh</span>
            </label>
            
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' :
                connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-pulse' :
                connectionState === ConnectionState.RECONNECTING ? 'bg-orange-500 animate-pulse' :
                connectionState === ConnectionState.ERROR ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-sm">
                {connectionState === ConnectionState.CONNECTED ? 'Connected' :
                 connectionState === ConnectionState.CONNECTING ? 'Connecting...' :
                 connectionState === ConnectionState.RECONNECTING ? 'Reconnecting...' :
                 connectionState === ConnectionState.ERROR ? 'Error' :
                 'Disconnected'}
              </span>
            </div>
            
            <button 
              onClick={fetchSessions}
              disabled={isLoading}
              className="p-2 hover:bg-gray-700 rounded-lg disabled:opacity-50"
              title="Refresh sessions"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
          <nav className="space-y-2">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <Activity className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setCurrentView('sessions')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${currentView === 'sessions' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Sessions</span>
            </button>
            <button 
              onClick={() => setCurrentView('agents')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${currentView === 'agents' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <Users className="w-5 h-5" />
              <span>Agents</span>
            </button>
            <button 
              onClick={() => setCurrentView('analytics')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${currentView === 'analytics' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Analytics</span>
            </button>
            <button 
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${currentView === 'settings' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
            <button 
              onClick={() => setCurrentView('console')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg ${currentView === 'console' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              <Terminal className="w-5 h-5" />
              <span>Console</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Session Detail Modal */}
      {showSessionDetail && selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={() => {
            setShowSessionDetail(false);
            setSelectedSession(null);
          }}
          onRefresh={() => {
            fetchSessions();
            addConsoleMessage('info', `Refreshed session: ${selectedSession.key}`);
          }}
          onExport={() => {
            const data = JSON.stringify(selectedSession, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            addConsoleMessage('info', `Exported session: ${selectedSession.key}`);
          }}
          onDelete={() => {
            if (confirm('Are you sure you want to delete this session?')) {
              addConsoleMessage('info', `Deleted session: ${selectedSession.key}`);
              setShowSessionDetail(false);
              setSelectedSession(null);
            }
          }}
        />
      )}
    </div>
  );
}
