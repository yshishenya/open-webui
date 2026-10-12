// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, NodeSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { listDragHandlePlugin, listPointerDragKey } from './listDragHandlePlugin';

it('starts dragging only a current selectable list item and preserves the document', () => {
	const schema = new Schema({
		nodes: {
			doc: { content: 'block+' },
			paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0] },
			bullet_list: { content: 'list_item+', group: 'block', toDOM: () => ['ul', 0] },
			list_item: { content: 'paragraph', toDOM: () => ['li', 0] },
			text: { group: 'inline' }
		}
	});
	const doc = schema.node('doc', null, [
		schema.node('bullet_list', null, [
			schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('one')])])
		])
	]);
	for (const position of [2, undefined, NaN, -1, 0, 3, doc.content.size + 10]) {
		const target = document.createElement('div');
		document.body.append(target);
		const plugin = listDragHandlePlugin();
		const view = new EditorView(target, {
			state: EditorState.create({ doc, plugins: [plugin] })
		});
		try {
			const handle = target.querySelector('.pm-list-drag-handle') as HTMLElement & {
				pmGetPos: () => number | undefined;
			};
			handle.pmGetPos = () => position;
			handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
			const drag = listPointerDragKey.getState(view.state)?.dragging;
			if (position === 2) {
				expect(view.state.selection).toBeInstanceOf(NodeSelection);
				expect(drag?.fromStart).toBe(1);
				expect(document.querySelector('.pm-li-ghost')).not.toBeNull();
			} else {
				expect(drag, `stale position ${position}`).toBeNull();
				expect(document.querySelector('.pm-li-ghost')).toBeNull();
			}
			expect(view.state.doc.toJSON()).toEqual(doc.toJSON());
		} finally {
			window.dispatchEvent(new MouseEvent('mouseup'));
			view.destroy();
			target.remove();
		}
	}
});
