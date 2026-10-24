/**
 * Keep previous/next identical: both use the flipbook curl animation and bottom corner.
 * Use the engine's authoritative page index (UI progress may update later).
 */
export function animatedTurn(engine,direction,totalPages){
 if(!engine||!engine.isReady()||engine.isAnimating()||![-1,1].includes(direction))return false;
 const current=engine.getCurrentPageIndex();
 const next=current+direction;
 if(next<0||next>=totalPages)return false;
 if(!engine.canTurn(direction===-1?'prev':'next'))return false;
 return direction===-1?engine.flipPrev('bottom'):engine.flipNext('bottom');
}
