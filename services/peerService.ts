import Peer, { DataConnection } from 'peerjs';
import { MultiplayerMessage } from '../types';

// Helper to generate a short 4-char ID
export const generateRoomId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

class PeerService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onDataCallback: ((data: MultiplayerMessage) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;

  init(id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use public PeerJS server
      this.peer = new Peer(id || generateRoomId(), {
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error', err);
        reject(err);
      });
    });
  }

  connect(peerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject("Peer not initialized");
      
      const conn = this.peer.connect(peerId);
      
      conn.on('open', () => {
        this.handleConnection(conn);
        resolve();
      });

      conn.on('error', (err) => {
        console.error("Connection error", err);
        reject(err);
      });
    });
  }

  private handleConnection(conn: DataConnection) {
    this.conn = conn;
    if (this.onConnectCallback) this.onConnectCallback();

    conn.on('data', (data) => {
      if (this.onDataCallback) {
        this.onDataCallback(data as MultiplayerMessage);
      }
    });

    conn.on('close', () => {
      console.log("Connection closed");
      this.conn = null;
    });
  }

  send(data: MultiplayerMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    } else {
      console.warn("Cannot send, connection not open");
    }
  }

  onData(cb: (data: MultiplayerMessage) => void) {
    this.onDataCallback = cb;
  }

  onConnect(cb: () => void) {
    this.onConnectCallback = cb;
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.conn = null;
  }
}

export const peerService = new PeerService();
