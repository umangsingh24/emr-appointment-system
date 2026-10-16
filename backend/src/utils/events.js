import { EventEmitter } from 'node:events';

/**
 * In-process domain event bus. Services publish what happened; transport layers
 * (Socket.IO today, a message broker tomorrow) subscribe. This keeps business logic
 * free of any WebSocket dependency.
 */
export const domainEvents = new EventEmitter();
domainEvents.setMaxListeners(20);
