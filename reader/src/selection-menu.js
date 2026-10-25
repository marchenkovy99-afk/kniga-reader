/** Suppress browser callouts only over book text; editing fields keep their menu. */
export function attachBookSelectionMenu(stage,offerActions){
 stage.addEventListener('contextmenu',event=>{
  const text=event.target?.closest?.('.book-text');
  if(!text||!stage.contains(text)||event.target.closest('input,textarea,[contenteditable="true"]'))return;
  event.preventDefault();
  offerActions();
 });
}
