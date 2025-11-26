import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const connectedUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.user_id;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userEmail})`);

    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      userId: socket.userId,
      email: socket.userEmail,
      role: socket.userRole,
      connectedAt: new Date()
    });

    socket.join(`user_${socket.userId}`);

    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      email: socket.userEmail
    });

    socket.on('join_conversation', (data) => {
      const { otherUserId } = data;
      const conversationId = [socket.userId, otherUserId].sort().join('_');
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    socket.on('leave_conversation', (data) => {
      const { otherUserId } = data;
      const conversationId = [socket.userId, otherUserId].sort().join('_');
      socket.leave(`conversation_${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    socket.on('typing_start', (data) => {
      const { otherUserId } = data;
      const conversationId = [socket.userId, otherUserId].sort().join('_');
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.userId,
        email: socket.userEmail,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { otherUserId } = data;
      const conversationId = [socket.userId, otherUserId].sort().join('_');
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.userId,
        email: socket.userEmail,
        isTyping: false
      });
    });

    socket.on('message_seen', (data) => {
      const { messageId, senderId } = data;
      socket.to(`user_${senderId}`).emit('message_seen', {
        messageId,
        seenBy: socket.userId,
        seenAt: new Date()
      });
    });

    
    socket.on('wishlist_subscribe', (data = {}) => {
      try {
        const ids = Array.isArray(data.ids) ? data.ids : [];
        ids.map(String).forEach((pid) => {
          if (!pid) return;
          socket.join(`property_${pid}`);
        });
        
        socket.emit('wishlist_subscribed', { count: ids.length });
      } catch (e) { /* ignore */ }
    });
    socket.on('wishlist_unsubscribe', (data = {}) => {
      try {
        const ids = Array.isArray(data.ids) ? data.ids : [];
        ids.map(String).forEach((pid) => {
          if (!pid) return;
          socket.leave(`property_${pid}`);
        });
        socket.emit('wishlist_unsubscribed', { count: ids.length });
      } catch (e) { /* ignore */ }
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.userId} (${socket.userEmail}) - Reason: ${reason}`);

      connectedUsers.delete(socket.userId);

      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        email: socket.userEmail
      });
    });

    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

const emitToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data);
};

const emitToConversation = (io, userId1, userId2, event, data) => {
  const conversationId = [userId1, userId2].sort().join('_');
  io.to(`conversation_${conversationId}`).emit(event, data);
};

const emitToAllUsers = (io, event, data) => {
  io.emit(event, data);
};


const emitToProperty = (io, propertyId, event, data) => {
  io.to(`property_${String(propertyId)}`).emit(event, data);
};

const getConnectedUsers = () => {
  return Array.from(connectedUsers.values());
};

const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

export {
  initializeSocket,
  emitToUser,
  emitToConversation,
  emitToAllUsers,
  emitToProperty,
  getConnectedUsers,
  isUserOnline
};