import React, { useState } from 'react';
import { LinkGroup } from '../../types';

interface SettingsShortcutsTabProps {
    linkGroups: LinkGroup[];
    onUpdateLinks: (groups: LinkGroup[]) => void;
    linkIconMode: 'favicon' | 'arrow' | 'hide';
    setLinkIconMode: (mode: 'favicon' | 'arrow' | 'hide') => void;
}

export const SettingsShortcutsTab: React.FC<SettingsShortcutsTabProps> = ({
    linkGroups,
    onUpdateLinks,
    linkIconMode,
    setLinkIconMode,
}) => {
    const [newCatName, setNewCatName] = useState('');
    const [newLinkInputs, setNewLinkInputs] = useState<Record<string, { label: string, url: string, favicon: string }>>({});
    const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
    const [draggedLink, setDraggedLink] = useState<{ groupIndex: number; linkIndex: number } | null>(null);

    const handleAddCategory = () => {
        if (!newCatName.trim()) return;
        onUpdateLinks([...linkGroups, { category: newCatName, links: [] }]);
        setNewCatName('');
    };

    const handleDeleteCategory = (catIndex: number) => {
        const newGroups = [...linkGroups];
        newGroups.splice(catIndex, 1);
        onUpdateLinks(newGroups);
    };

    const handleEditCategory = (catIndex: number, value: string) => {
        const newGroups = [...linkGroups];
        if (!newGroups[catIndex]) return;
        newGroups[catIndex] = {
            ...newGroups[catIndex],
            category: value
        };
        onUpdateLinks(newGroups);
    };

    const handleAddLink = (catIndex: number) => {
        const catName = linkGroups[catIndex].category;
        const input = newLinkInputs[catName] || { label: '', url: '', favicon: '' };

        if (!input.label.trim() || !input.url.trim()) return;

        const newGroups = [...linkGroups];
        newGroups[catIndex].links.push({
            label: input.label,
            url: input.url,
            favicon: input.favicon.trim() || undefined
        });
        onUpdateLinks(newGroups);

        setNewLinkInputs({
            ...newLinkInputs,
            [catName]: { label: '', url: '', favicon: '' }
        });
    };

    const handleDeleteLink = (catIndex: number, linkIndex: number) => {
        const newGroups = [...linkGroups];
        newGroups[catIndex].links.splice(linkIndex, 1);
        onUpdateLinks(newGroups);
    };

    const handleEditLink = (catIndex: number, linkIndex: number, field: 'label' | 'url' | 'favicon', value: string) => {
        const newGroups = [...linkGroups];
        const group = newGroups[catIndex];
        const link = group?.links?.[linkIndex];
        if (!link) return;

        group.links[linkIndex] = {
            ...link,
            [field]: value
        };
        onUpdateLinks(newGroups);
    };

    const moveGroup = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= linkGroups.length || toIndex >= linkGroups.length) return;

        const nextGroups = [...linkGroups];
        const [movedGroup] = nextGroups.splice(fromIndex, 1);
        nextGroups.splice(toIndex, 0, movedGroup);
        onUpdateLinks(nextGroups);
    };

    const moveLink = (fromGroupIndex: number, fromLinkIndex: number, toGroupIndex: number, toLinkIndex: number) => {
        const nextGroups = [...linkGroups];
        const sourceGroup = nextGroups[fromGroupIndex];
        const targetGroup = nextGroups[toGroupIndex];
        if (!sourceGroup || !targetGroup) return;
        if (!sourceGroup.links[fromLinkIndex]) return;

        const [movedLink] = sourceGroup.links.splice(fromLinkIndex, 1);
        const boundedIndex = Math.max(0, Math.min(toLinkIndex, targetGroup.links.length));
        targetGroup.links.splice(boundedIndex, 0, movedLink);
        onUpdateLinks(nextGroups);
    };

    const updateLinkInput = (catName: string, field: 'label' | 'url' | 'favicon', value: string) => {
        setNewLinkInputs({
            ...newLinkInputs,
            [catName]: {
                ...(newLinkInputs[catName] || { label: '', url: '', favicon: '' }),
                [field]: value
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-3">Favicons</h3>
                <div className="flex gap-4 flex-wrap">
                    <div onClick={() => setLinkIconMode('favicon')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {linkIconMode === 'favicon' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">show favicon</span>
                    </div>
                    <div onClick={() => setLinkIconMode('arrow')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {linkIconMode === 'arrow' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">show &gt;</span>
                    </div>
                    <div onClick={() => setLinkIconMode('hide')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {linkIconMode === 'hide' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">hide</span>
                    </div>
                </div>
            </div>

            {linkGroups.map((group, groupIdx) => (
                <div
                    key={groupIdx}
                    className={`border border-[var(--color-border)] p-4 relative no-radius ${draggedGroupIndex === groupIdx ? 'opacity-70' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (draggedGroupIndex !== null) {
                            moveGroup(draggedGroupIndex, groupIdx);
                        }
                        setDraggedGroupIndex(null);
                    }}
                >
                    <div className="flex justify-between items-center mb-3">
                        <button
                            type="button"
                            draggable
                            onDragStart={() => setDraggedGroupIndex(groupIdx)}
                            onDragEnd={() => setDraggedGroupIndex(null)}
                            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-xs mr-2 cursor-move"
                            title="Drag to reorder group"
                        >
                            [::]
                        </button>
                        <input
                            type="text"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-accent)] font-bold px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full mr-3 select-text no-radius"
                            value={group.category}
                            onChange={(e) => handleEditCategory(groupIdx, e.target.value)}
                        />
                        <button
                            onClick={() => handleDeleteCategory(groupIdx)}
                            className="text-[var(--color-muted)] hover:text-red-500 text-xs whitespace-nowrap"
                        >
                            [delete group]
                        </button>
                    </div>

                    <div className="space-y-2 mb-4">
                        {group.links.map((link, linkIdx) => (
                            <div
                                key={linkIdx}
                                className={`flex items-center justify-between bg-[var(--color-hover)] p-2 px-3 text-sm ${draggedLink?.groupIndex === groupIdx && draggedLink?.linkIndex === linkIdx ? 'opacity-70' : ''}`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (!draggedLink) return;
                                    moveLink(draggedLink.groupIndex, draggedLink.linkIndex, groupIdx, linkIdx);
                                    setDraggedLink(null);
                                }}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 overflow-hidden flex-1 pr-2">
                                    <button
                                        type="button"
                                        draggable
                                        onDragStart={() => setDraggedLink({ groupIndex: groupIdx, linkIndex: linkIdx })}
                                        onDragEnd={() => setDraggedLink(null)}
                                        className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-xs cursor-move self-start sm:self-center"
                                        title="Drag to reorder shortcut"
                                    >
                                        [::]
                                    </button>
                                    <input
                                        type="text"
                                        className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full sm:w-1/3 select-text no-radius"
                                        value={link.label}
                                        onChange={(e) => handleEditLink(groupIdx, linkIdx, 'label', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)] px-2 py-1 text-xs focus:border-[var(--color-accent)] outline-none flex-1 select-text no-radius"
                                        value={link.url}
                                        onChange={(e) => handleEditLink(groupIdx, linkIdx, 'url', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="favicon override URL"
                                        className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)] px-2 py-1 text-xs focus:border-[var(--color-accent)] outline-none flex-1 select-text no-radius"
                                        value={link.favicon || ''}
                                        onChange={(e) => handleEditLink(groupIdx, linkIdx, 'favicon', e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => handleDeleteLink(groupIdx, linkIdx)}
                                    className="text-[var(--color-muted)] hover:text-red-500 ml-2"
                                >
                                    x
                                </button>
                            </div>
                        ))}
                        {group.links.length > 0 && (
                            <div
                                className="text-[10px] text-[var(--color-muted)] border border-dashed border-[var(--color-border)] px-2 py-1"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (!draggedLink) return;
                                    moveLink(draggedLink.groupIndex, draggedLink.linkIndex, groupIdx, group.links.length);
                                    setDraggedLink(null);
                                }}
                            >
                                drop here to move to end
                            </div>
                        )}
                    </div>


                    <div className="flex flex-col sm:flex-row gap-2 mt-2 pt-2 border-t border-[var(--color-border)] border-dashed">
                        <input
                            type="text"
                            placeholder="label"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full sm:w-1/4 select-text no-radius"
                            value={newLinkInputs[group.category]?.label || ''}
                            onChange={(e) => updateLinkInput(group.category, 'label', e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="url (https://...)"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none flex-1 select-text no-radius"
                            value={newLinkInputs[group.category]?.url || ''}
                            onChange={(e) => updateLinkInput(group.category, 'url', e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="favicon URL (optional)"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none flex-1 select-text no-radius"
                            value={newLinkInputs[group.category]?.favicon || ''}
                            onChange={(e) => updateLinkInput(group.category, 'favicon', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddLink(groupIdx)}
                        />
                        <button
                            onClick={() => handleAddLink(groupIdx)}
                            className="border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)] px-3 py-1 text-sm no-radius"
                        >
                            add
                        </button>
                    </div>
                </div>
            ))}


            <div className="flex gap-2 items-center mt-6 p-4 border border-[var(--color-border)] border-dashed opacity-70 hover:opacity-100 transition-opacity">
                <span className="text-[var(--color-muted)] text-sm">New Category:</span>
                <input
                    type="text"
                    placeholder="category name"
                    className="bg-[var(--color-bg)] border-b border-[var(--color-muted)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none select-text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button
                    onClick={handleAddCategory}
                    className="text-[var(--color-fg)] hover:text-[var(--color-accent)] text-sm font-bold"
                >
                    [ + ]
                </button>
            </div>
        </div>
    );
};
