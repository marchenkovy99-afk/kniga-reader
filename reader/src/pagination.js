export {applyTypography,typographyEnvironment} from './typography.js';
import {paginateDOM} from './dom-pagination.js';

/** Explicit local rollback; source positions and the cloud schema stay unchanged. */
export async function paginate(blocks,options){
 if(options.engine==='legacy')return (await import('./legacy-pagination.js')).paginate(blocks,options);
 return paginateDOM(blocks,options);
}
