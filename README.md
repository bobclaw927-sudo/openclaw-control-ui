# OpenClaw Control UI

A modern web-based control interface for managing your OpenClaw instance.

## Features

✅ **Real-time WebSocket Connection** - Live updates from your OpenClaw Gateway  
✅ **Session Management** - View and manage all active sessions  
✅ **Analytics Dashboard** - Token usage, session stats, and system health  
✅ **Interactive Console** - Send commands directly to OpenClaw  
✅ **Agent Control** - Manage multiple agents from one interface  
✅ **Responsive Design** - Works on desktop, tablet, and mobile  

## Screenshots

- **Dashboard**: Overview of sessions, token usage, and gateway status
- **Sessions**: Detailed view of active conversations with token tracking
- **Console**: Terminal-style interface for executing commands

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **WebSocket**: Native WebSocket API
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ 
- A running OpenClaw Gateway instance
- Gateway authentication token

## Installation

### 1. Install Dependencies

```bash
cd /root/.openclaw/workspace/openclaw-control-ui
npm install
```

### 2. Configure Environment

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Gateway details:

```bash
NEXT_PUBLIC_GATEWAY_URL=ws://localhost:18789
NEXT_PUBLIC_GATEWAY_TOKEN=your-gateway-token-here
```

**Finding your Gateway token:**

```bash
# Check your OpenClaw config
cat ~/.openclaw/openclaw.json | grep -A 2 '"auth"'
```

### 3. Start the Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3001**

### 4. Build for Production

```bash
npm run build
npm start
```

## Configuration

### Gateway Connection

The Control UI connects to your OpenClaw Gateway via WebSocket. Make sure your Gateway is configured to allow connections:

```json
{
  "gateway": {
    "port": 18789,
    "bind": "loopback",
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:3001"
      ]
    }
  }
}
```

### Remote Access

To access the Control UI from another machine:

1. **Update Gateway bind:**
   ```json
   {
     "gateway": {
       "bind": "0.0.0.0"
     }
   }
   ```

2. **Update CORS:**
   ```json
   {
     "gateway": {
       "controlUi": {
         "allowedOrigins": ["*"]
       }
     }
   }
   ```

3. **Update .env.local:**
   ```bash
   NEXT_PUBLIC_GATEWAY_URL=ws://YOUR_SERVER_IP:18789
   ```

⚠️ **Security Warning**: Only expose the Gateway to trusted networks. Use Tailscale or VPN for remote access.

## Features Breakdown

### 📊 Dashboard
- Active session count
- Total token usage across all sessions
- Gateway connection status
- Real-time updates

### 💬 Sessions
- List all active sessions
- Session details (key, model, tokens)
- Context usage visualization (progress bars)
- Session selection for detailed management

### 🖥️ Console
- Interactive terminal
- Send RPC commands to Gateway
- Real-time command output
- Command history

### ⚙️ Settings (Coming Soon)
- Agent configuration
- Model selection
- System preferences

### 📈 Analytics (Coming Soon)
- Token usage over time
- Session history
- Cost tracking
- Performance metrics

## WebSocket API

The Control UI uses OpenClaw's Gateway WebSocket protocol:

### Connect
```json
{
  "type": "req",
  "id": "connect-1",
  "method": "connect",
  "params": {
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "auth": { "token": "YOUR_TOKEN" }
  }
}
```

### List Sessions
```json
{
  "type": "req",
  "id": "sessions-1",
  "method": "sessions.list",
  "params": {}
}
```

### Send Message
```json
{
  "type": "req",
  "id": "msg-1",
  "method": "agent.message",
  "params": {
    "sessionKey": "agent:main:...",
    "message": "Hello!"
  }
}
```

## Development

### Project Structure

```
openclaw-control-ui/
├── app/
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard
├── public/                # Static assets
├── .env.local            # Environment config
├── next.config.js        # Next.js config
├── tailwind.config.ts    # Tailwind config
└── package.json          # Dependencies
```

### Adding New Features

1. **New Pages**: Add files to `app/` directory
2. **Components**: Create in `app/components/`
3. **API Routes**: Add to `app/api/` directory
4. **Styles**: Use Tailwind utility classes

### Custom Hooks

Example: `useGateway` hook for WebSocket management

```typescript
// app/hooks/useGateway.ts
import { useEffect, useRef, useState } from 'react';

export function useGateway() {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // WebSocket connection logic
  }, []);

  const sendRPC = (method: string, params: any) => {
    // RPC send logic
  };

  return { connected, sendRPC };
}
```

## Troubleshooting

### Can't Connect to Gateway

**Error**: `WebSocket connection failed`

**Solutions**:
1. Verify Gateway is running: `ps aux | grep openclaw-gateway`
2. Check Gateway port: `netstat -an | grep 18789`
3. Verify token in `.env.local` matches config
4. Check CORS settings in `openclaw.json`

### Sessions Not Loading

**Error**: `Failed to fetch sessions`

**Solutions**:
1. Check WebSocket connection status (green dot in header)
2. Verify operator scopes include `operator.read`
3. Check browser console for errors (F12)

### Permission Denied

**Error**: `403 Forbidden` or `Unauthorized`

**Solutions**:
1. Verify Gateway token is correct
2. Check operator scopes in connect request
3. Ensure Gateway auth mode allows token authentication

## API Documentation

Full OpenClaw Gateway protocol documentation:
- [Gateway Protocol](https://docs.openclaw.ai/gateway/protocol)
- [RPC Methods](https://docs.openclaw.ai/reference/rpc)

## Contributing

Want to add features? Here are some ideas:

- [ ] Real-time log streaming
- [ ] Agent configuration UI
- [ ] Session history browser
- [ ] Cost tracking dashboard
- [ ] Model performance analytics
- [ ] Dark/Light theme toggle
- [ ] Export session transcripts
- [ ] Cron job management UI

## License

MIT

## Support

- [OpenClaw Docs](https://docs.openclaw.ai)
- [Discord Community](https://discord.com/invite/clawd)
- [GitHub Issues](https://github.com/openclaw/openclaw)

---

**Made with ❤️ for the OpenClaw community**
