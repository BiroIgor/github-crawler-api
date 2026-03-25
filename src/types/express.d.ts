declare global {
  namespace Express {
    interface Request {
      listQuery?: { limit: number; offset: number };
    }
  }
}

export {};
