import type { ClipIssue } from '../clippingGuard';
import '../clipping.css';
export function ClippingAlert({onRetry,issue}:{onRetry:()=>void;issue?:ClipIssue|null}){
 return <div className="clipping-alert" role="alert" data-clipping-kind={issue?.kind}>
  <span>Ошибка вёрстки: текст не помещается на странице. Глава открыта целиком с прокруткой.</span>
  <button type="button" onClick={onRetry}>Проверить страницы</button>
 </div>;
}
