import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { genKey, findItem, pushChangeLog, sanitizeFilename, dlBlob } from '../utils/itemUtils.js';

export function useModals() {
  const store = useAppStore();
  const { saveToServer, saveLocal, lockItem, unlockItem, logActivity, broadcastSharedData } = useDBSync();

  const openModal = useCallback((id) => {
    store.setActiveModal(id);
    const el = document.getElementById(id);
    if (el) el.classList.add('on');
  }, [store]);

  const closeModal = useCallback((id) => {
    const current = useAppStore.getState().activeModal;
    if (current === id) store.setActiveModal(null);
    const el = document.getElementById(id);
    if (el) el.classList.remove('on');
  }, [store]);

  const closeEditModal = useCallback(() => {
    const editKey = useAppStore.getState().editKey;
    if (editKey) unlockItem(editKey);
    useAppStore.getState().setEditKey(null);
    closeModal('editModal');
  }, [closeModal, unlockItem]);

  const openEditModal = useCallback((key) => {
    store.setEditKey(key);
    const item = findItem(key, store.items);
    if (!item) return;

    window.__editModalBridge?.('edit', key, { ...item });
    if (store.settings.storageMode === 'server') lockItem(key);
    openModal('editModal');
  }, [store, lockItem, openModal]);

  const openAddModal = useCallback((defaults = {}) => {
    store.setEditKey(null);
    const newKey = genKey();
    window.__editModalBridge?.('add', null, {
      key: newKey,
      priority: '중',
      name: '',
      desc: '',
      path: '',
      group: '',
      subGroup: '',
      category: '',
      subCategory: '',
      owner: '',
      status: '',
      relSystem: '',
      memo: '',
      mdContent: '',
      isImportant: 'N',
      isDelete: 'N',
      ...defaults
    });
    openModal('editModal');
  }, [store, openModal]);

  const openAddInCell = useCallback((group, subGroup, category, subCategory) => {
    openAddModal({
      group: group === '(미분류)' ? '' : (group || ''),
      subGroup: subGroup || '',
      category: category === '(미분류)' ? '' : (category || ''),
      subCategory: subCategory || '',
    });
  }, [openAddModal]);

  const openMdModal = useCallback((key) => {
    openEditModal(key);
    requestAnimationFrame(() => {
      window.__editModalSwitchEditTab?.('md');
      window.__editModalSwitchMdView?.('preview');
    });
  }, [openEditModal]);

  const saveItem = useCallback(async (form) => {
    const name = (form.name || '').trim();
    if (!name) {
      store.notify('기능명을 입력해주세요.', 'error');
      return;
    }

    const ni = {
      ...form,
      name,
      updatedAt: Date.now()
    };

    store.pushUndo();
    const items = [...store.items];
    const editKey = store.editKey;

    if (editKey) {
      const idx = items.findIndex(it => it.key === editKey);
      if (idx !== -1) {
        items[idx] = ni;
        pushChangeLog('수정', ni.key, ni.name, { status: ni.status, owner: ni.owner });
        logActivity('수정', `${ni.key} ${ni.name}`);
      }
    } else {
      items.push(ni);
      pushChangeLog('추가', ni.key, ni.name, { status: ni.status, owner: ni.owner });
      logActivity('추가', `${ni.key} ${ni.name}`);
    }

    store.setItems(items);
    closeModal('editModal');
    
    if (editKey) unlockItem(editKey);
    store.setEditKey(null);

    if (store.settings.storageMode === 'server') {
      await saveToServer();
      broadcastSharedData();
    } else {
      saveLocal();
    }
    
    store.notify('저장되었습니다.', 'success');
  }, [store, logActivity, closeModal, unlockItem, saveToServer, saveLocal, broadcastSharedData]);

  const hardDelete = useCallback(async (key) => {
    const it = findItem(key, store.items);
    if (!it || !confirm(`${key} 항목을 완전히 삭제하시겠습니까?`)) return;

    store.pushUndo();
    const nextItems = store.items.filter(it => it.key !== key);
    store.setItems(nextItems);
    
    logActivity('완전삭제', `${key} ${it.name || ''}`);
    pushChangeLog('완전삭제', key, it.name || key);
    
    closeModal('editModal');
    unlockItem(key);
    store.setEditKey(null);

    if (store.settings.storageMode === 'server') {
      await saveToServer();
      broadcastSharedData();
    } else {
      saveLocal();
    }
    store.notify('완전 삭제되었습니다.', 'success');
  }, [store, logActivity, closeModal, unlockItem, saveToServer, saveLocal, broadcastSharedData]);

  const duplicateItem = useCallback(async (key) => {
    const src = findItem(key, store.items);
    if (!src) return;
    
    store.pushUndo();
    const newItem = { ...src, key: genKey(), updatedAt: Date.now() };
    store.setItems([...store.items, newItem]);
    
    if (store.settings.storageMode === 'server') {
      await saveToServer();
      broadcastSharedData();
    } else {
      saveLocal();
    }
    store.notify(`${src.key} 복제 완료`, 'success');
  }, [store, saveToServer, saveLocal, broadcastSharedData]);

  const expSingleMd = useCallback((form) => {
    const content = form.mdContent || '';
    if (!content.trim()) {
      useAppStore.getState().notify('MD 내용이 없습니다.', 'error');
      return;
    }
    const key = form.key || 'unknown';
    const name = sanitizeFilename(form.name) || 'untitled';
    dlBlob(content, key + '_' + name + '.md', 'text/markdown;charset=utf-8');
    useAppStore.getState().notify('MD 파일 저장됨.', 'success');
  }, []);

  const quickToggleDel = useCallback(async (key) => {
    const item = findItem(key, store.items);
    if (!item) return;
    const nextValue = item.isDelete === 'Y' ? 'N' : 'Y';
    store.pushUndo();
    store.setItems(store.items.map(it => it.key === key ? { ...it, isDelete: nextValue, updatedAt: Date.now() } : it));
    pushChangeLog(nextValue === 'Y' ? '삭제처리' : '삭제복원', key, item.name || key);
    if (store.settings.storageMode === 'server') {
      await saveToServer();
      broadcastSharedData();
    } else {
      saveLocal();
    }
  }, [store, saveToServer, saveLocal, broadcastSharedData]);

  const setItemStatus = useCallback(async (key, status) => {
    const item = findItem(key, store.items);
    if (!item) return;
    store.pushUndo();
    store.setItems(store.items.map(it => it.key === key ? { ...it, status, updatedAt: Date.now() } : it));
    pushChangeLog('상태변경', key, item.name || key, { status, owner: item.owner });
    if (store.settings.storageMode === 'server') {
      await saveToServer();
      broadcastSharedData();
    } else {
      saveLocal();
    }
  }, [store, saveToServer, saveLocal, broadcastSharedData]);

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
