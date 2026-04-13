"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-red-400 block mb-4">error</span>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-slate-500 mb-6">
              {this.state.message || "Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу."}
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-ktzh-dark text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
