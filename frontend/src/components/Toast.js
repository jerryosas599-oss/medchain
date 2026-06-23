import React from 'react';

export function Toast({ message, type='info' }){
  return (
    <div className={`toast ${type==='success'? 'success' : type==='error'? 'error' : type==='info'? 'info' : ''}`} style={{ animation: 'slideInRight 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <span style={{ flex:1 }}>
      {message}
      </span>
    </div>
  );
}

export function ToastContainer({ toasts }){
  return (
    <div className="toast-container">
      {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
    </div>
  );
}
