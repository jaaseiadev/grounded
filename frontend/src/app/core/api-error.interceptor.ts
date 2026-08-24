import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => new Error('A network error interrupted the request.'));
      }
      const body: unknown = error.error;
      const serverMessage =
        body && typeof body === 'object' && 'message' in body ? body.message : undefined;
      const message = Array.isArray(serverMessage)
        ? serverMessage.join(' ')
        : typeof serverMessage === 'string'
          ? serverMessage
          : error.status === 0
            ? 'The Grounded API is unreachable. Is the backend running?'
            : `Request failed (${error.status}).`;
      return throwError(() => new Error(message));
    }),
  );
