import { useCallback } from 'react';
import type { Item } from '../types/index.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { usePersistItems } from './usePersistItems.js';
import { genKey, findItem, pushChangeLog, sanitizeFilename, dlBlob } from '../utils/itemUtils.js';

export function useModals() {
  const { lockItem, unlockItem, logActivity } = useDBSync();
  const { persistItems } = usePersistItems();

  const openModal = useCallback((id: string) => {
    useAppStore.getState().setActiveModal(id);
  }, []);

  const closeModal = useCallback((id: string) => {
    if (useAppStore.getState().activeModal === id) {
      useAppStore.getState().setActiveModal(null);
    }
  }, []);

  const closeEditModal = useCallback(() => {
    const { editKey, setEditKey, closeEditModal: close } = useAppStore.getState();
    if (editKey) unlockItem(editKey);
    setEditKey(null);
    close();
  }, [unlockItem]);

  const openEditModal = useCallback((key: string) => {
    const { setEditKey, openEditModal: open, items, settings } = useAppStore.getState();
    const item = findItem(key, items);
    if (!item) return;
    setEditKey(key);
    open('edit', key, { ...item });
    if (settings.storageMode === 'server') lockItem(key);
  }, [lockItem]);

  const openAddModal = useCallback((defaults: Partial<Item> = {}) => {
    const { setEditKey, openEditModal: open } = useAppStore.getState();
    setEditKey(null);
    const newKey = genKey();
    const newItem: Item = {
      key: newKey, priority: '중', name: '', desc: '', path: '',
      group: '', subGroup: '', category: '', subCategory: '',
      owner: '', status: '', relSystem: '', memo: '', mdContent: '',
      isImportant: 'N', isDelete: 'N', ...defaults,
    };
    open('add', newKey, newItem);
  }, []);

  const openAddInCell = useCallback((group: string, subGroup: string, category: string, subCategory: string) => {
    openAddModal({
      group:       group    === '(미분류)' ? '' : (group    || ''),
      subGroup:    subGroup || '',
      category:    category === '(미분류)' ? '' : (category || ''),
      subCategory: subCategory || '',
    });
  }, [openAddModal]);

  const openMdModal = useCallback((key: string) => {
    const { setEditKey, openEditModal: open, items, settings } = useAppStore.getState();
    const item = findItem(key, items);
    if (!item) return;
    const nextMdMode = item.mdContent?.trim() ? 'preview' : 'edit';
    setEditKey(key);
    open('edit', key, { ...item }, 'md', nextMdMode);
    if (settings.storageMode === 'server') lockItem(key);
  }, [lockItem]);

  const saveItem = useCallback(async (form: Item) => {
    const { notify, pushUndo, items, editKey, setItems, setEditKey, closeEditModal: close } = useAppStore.getState();
    const name = (form.name || '').trim();
    if (!name) {
      notify('기능명을 입력해주세요.', 'error');
      return;
    }

    const ni: Item = { ...form, name, updatedAt: Date.now() };

    pushUndo();
    const nextItems = [...items];

    if (editKey) {
      const idx = nextItems.findIndex(it => it.key === editKey);
      if (idx !== -1) {
        nextItems[idx] = ni;
        pushChangeLog('수정', ni.key, ni.name, { status: ni.status, owner: ni.owner });
        logActivity('수정', `${ni.key} ${ni.name}`);
      }
    } else {
      nextItems.push(ni);
      pushChangeLog('추가', ni.key, ni.name, { status: ni.status, owner: ni.owner });
      logActivity('추가', `${ni.key} ${ni.name}`);
    }

    setItems(nextItems);
    close();
    if (editKey) unlockItem(editKey);
    setEditKey(null);

    await persistItems();
    notify('저장되었습니다.', 'success');
  }, [logActivity, unlockItem, persistItems]);

  const hardDelete = useCallback(async (key: string) => {
    const { items, notify, pushUndo, setItems, setEditKey, closeEditModal: close } = useAppStore.getState();
    const it = findItem(key, items);
    if (!it || !confirm(`${key} 항목을 완전히 삭제하시겠습니까?`)) return;

    pushUndo();
    setItems(items.filter(i => i.key !== key));
    logActivity('완전삭제', `${key} ${it.name || ''}`);
    pushChangeLog('완전삭제', key, it.name || key);

    close();
    unlockItem(key);
    setEditKey(null);

    await persistItems();
    notify('완전 삭제되었습니다.', 'success');
  }, [logActivity, unlockItem, persistItems]);

  const duplicateItem = useCallback(async (key: string) => {
    const { items, notify, pushUndo, setItems } = useAppStore.getState();
    const src = findItem(key, items);
    if (!src) return;

    pushUndo();
    setItems([...items, { ...src, key: genKey(), updatedAt: Date.now() }]);

    await persistItems();
    notify(`${src.key} 복제 완료`, 'success');
  }, [persistItems]);

  const expSingleMd = useCallback((form: Item) => {
    const content = form.mdContent || '';
    if (!content.trim()) {
      useAppStore.getState().notify('MD 내용이 없습니다.', 'error');
      return;
    }
    const key  = form.key || 'unknown';
    const name = sanitizeFilename(form.name) || 'untitled';
    dlBlob(content, `${key}_${name}.md`, 'text/markdown;charset=utf-8');
    useAppStore.getState().notify('MD 파일 저장됨.', 'success');
  }, []);

  const quickToggleDel = useCallback(async (key: string) => {
    const { items, pushUndo, setItems } = useAppStore.getState();
    const item = findItem(key, items);
    if (!item) return;
    const nextValue = item.isDelete === 'Y' ? 'N' : 'Y';
    pushUndo();
    setItems(items.map(it =>
      it.key === key ? { ...it, isDelete: nextValue, updatedAt: Date.now() } : it
    ));
    pushChangeLog(nextValue === 'Y' ? '삭제처리' : '삭제복원', key, item.name || key);
    await persistItems();
  }, [persistItems]);

  const setItemStatus = useCallback(async (key: string, status: string) => {
    const { items, pushUndo, setItems } = useAppStore.getState();
    const item = findItem(key, items);
    if (!item) return;
    pushUndo();
    setItems(items.map(it =>
      it.key === key ? { ...it, status, updatedAt: Date.now() } : it
    ));
    pushChangeLog('상태변경', key, item.name || key, { status, owner: item.owner });
    await persistItems();
  }, [persistItems]);

  return {
    openModal,
    closeModal,
    closeEditModal,
    openEditModal,
    openAddModal,
    openAddInCell,
    openMdModal,
    saveItem,
    hardDelete,
    duplicateItem,
    quickToggleDel,
    setItemStatus,
    expSingleMd,
  };
}
