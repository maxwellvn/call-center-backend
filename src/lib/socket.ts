type SocketPayload = Record<string, unknown>;

export function emitSocketEvent(event: string, payload: SocketPayload, rooms: string[] = []) {
  const io = globalThis.io;
  if (!io) {
    return;
  }

  if (rooms.length === 0) {
    io.emit(event, payload);
    return;
  }

  for (const room of rooms) {
    io.to(room).emit(event, payload);
  }
}
