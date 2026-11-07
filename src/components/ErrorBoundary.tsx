import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildReport, logEntry } from '../lib/diagnostics';
import { newIssueUrl } from '../lib/links';
import { IS_ANDROID } from '../lib/platform';
import { APP_VERSION } from '../lib/version';
import { openExternal } from '../lib/window';
import { navigate, toast } from '../store/ui';

interface Props {
  children: ReactNode;
  /** page: упала одна страница (плеер и меню живы); app: упал весь интерфейс. */
  scope: 'page' | 'app';
  /** Смена ключа сбрасывает ошибку: например, переход на другую страницу. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Ловит ошибки отрисовки. Без него React 19 при любой ошибке в компоненте
 * размонтирует всё приложение, и человек видит пустое окно.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    logEntry('error', `Сбой интерфейса (${this.props.scope}):`, error, info.componentStack ?? '');
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <CrashScreen error={error} scope={this.props.scope} retry={() => this.setState({ error: null })} />;
  }
}

function CrashScreen({ error, scope, retry }: { error: Error; scope: Props['scope']; retry: () => void }) {
  const copyReport = async () => {
    const report = buildReport({
      'Версия': APP_VERSION,
      'Платформа': IS_ANDROID ? 'Android' : 'Windows',
      'Где': scope === 'page' ? 'страница' : 'весь интерфейс',
      'Ошибка': error.message,
      'Стек': (error.stack ?? '').split('\n').slice(0, 8).join(' | '),
    });
    try {
      await navigator.clipboard.writeText(report);
      toast('Отчёт скопирован. Вставьте его в задачу на GitHub', 'success', { label: 'Открыть', onClick: () => void openExternal(newIssueUrl()) });
    } catch {
      toast('Буфер обмена недоступен', 'error');
    }
  };

  return (
    <div className={`crash crash--${scope}`} role="alert">
      <h2 className="crash__title">{scope === 'page' ? 'Эта страница не открылась' : 'Что-то пошло не так'}</h2>
      <p className="crash__text">
        {scope === 'page'
          ? 'Музыка продолжает играть. Попробуйте ещё раз или вернитесь на главную.'
          : 'Интерфейс Frost споткнулся. Перезапуск интерфейса обычно помогает, библиотека и настройки на месте.'}
      </p>
      <code className="crash__error">{error.message || 'Неизвестная ошибка'}</code>
      <div className="crash__actions">
        {scope === 'page' ? (
          <>
            <button className="btn btn--primary" onClick={retry}>
              Попробовать снова
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                navigate({ name: 'home' });
                retry();
              }}
            >
              На главную
            </button>
          </>
        ) : (
          <button className="btn btn--primary" onClick={() => location.reload()}>
            Перезапустить интерфейс
          </button>
        )}
        <button className="btn btn--ghost" onClick={() => void copyReport()}>
          Скопировать отчёт
        </button>
      </div>
    </div>
  );
}
