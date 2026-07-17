import { expect, test } from 'vitest';
import { AppError } from './AppError.js';

test('AppError should correctly set status code and message', () => {
    const error = new AppError('Unauthorized', 401);
    expect(error.message).toBe('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.isOperational).toBe(true);
});

test('AppError should correctly set isOperational flag', () => {
    const error = new AppError('System error', 500, false);
    expect(error.isOperational).toBe(false);
});
