'use client';

import { useState, useEffect, useCallback } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { toast } from 'sonner';
import { STORAGE_KEY, safeParseWorkspaces, persistWorkspaces } from '../components/sqlForgeConstants';

export function useWorkspace() {
  const { qualityMode } = useApp();

  const [workspaces, setWorkspaces] = useState({ 'Default Project': '' });
  const [activeWorkspace, setActiveWorkspace] = useState('Default Project');
  const [schema, setSchema] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [mockLoading, setMockLoading] = useState(false);

  // Rehydrate persisted workspaces on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = safeParseWorkspaces(raw);
    if (!parsed) return;
    setWorkspaces(parsed);
    const firstKey = Object.keys(parsed)[0];
    setActiveWorkspace(firstKey);
    setSchema(parsed[firstKey] ?? '');
  }, []);

  const handleSchemaChange = useCallback((val) => {
    setSchema(val);
    setWorkspaces((prev) => {
      const updated = { ...prev, [activeWorkspace]: val };
      persistWorkspaces(updated);
      return updated;
    });
  }, [activeWorkspace]);

  const switchWorkspace = useCallback((name) => {
    setActiveWorkspace(name);
    setSchema(workspaces[name] ?? '');
  }, [workspaces]);

  const openWorkspaceModal = () => { setNewWorkspaceName(''); setIsWorkspaceModalOpen(true); };
  const closeWorkspaceModal = () => { setIsWorkspaceModalOpen(false); setNewWorkspaceName(''); };

  const confirmCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) { toast.error('Workspace name cannot be empty.'); return; }
    if (workspaces[name]) { toast.error(`Workspace "${name}" already exists.`); return; }

    setWorkspaces((prev) => {
      const updated = { ...prev, [name]: '' };
      persistWorkspaces(updated);
      return updated;
    });
    setActiveWorkspace(name);
    setSchema('');
    toast.success(`Workspace "${name}" created.`);
    closeWorkspaceModal();
  };

  const deleteWorkspace = (name) => {
    const keys = Object.keys(workspaces);
    if (keys.length <= 1) { toast.error("You can't delete the last workspace."); return; }

    setWorkspaces((prev) => {
      const updated = { ...prev };
      delete updated[name];
      persistWorkspaces(updated);
      const nextKey = Object.keys(updated)[0];
      setActiveWorkspace(nextKey);
      setSchema(updated[nextKey] ?? '');
      return updated;
    });
    toast.success(`Workspace "${name}" deleted.`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (evt) => {
      handleSchemaChange(evt.target.result);
      toast.success('Schema loaded from file!');
      setShowSchema(true);
    };
    reader.onerror = () => toast.error('Failed to read the file.');
    reader.readAsText(file);
  };

  const handleCopySchema = async () => {
    if (!schema) return;
    try {
      await navigator.clipboard.writeText(schema);
      toast.success('Schema copied!');
    } catch {
      toast.error('Copy failed.');
    }
  };

  const handleClearSchema = () => {
    handleSchemaChange('');
    toast.success('Schema cleared.');
  };

  const handleGenerateMockData = async (targetDialect) => {
    if (!schema.trim()) { toast.error('Add a schema first.'); return; }
    setMockLoading(true);
    try {
      const result = await convertCode('sql', 'Generate mock data', {
        targetLang: targetDialect,
        mode: 'mock',
        schema,
        qualityMode,
      });
      if (result?.query) {
        handleSchemaChange(`${schema}\n\n-- Mock Data\n${result.query}`);
        toast.success('Mock data appended to schema!');
      }
    } catch (err) {
      toast.error(`Mock data generation failed: ${err.message}`);
    } finally {
      setMockLoading(false);
    }
  };

  return {
    schema, handleSchemaChange, handleCopySchema, handleClearSchema,
    showSchema, setShowSchema,
    workspaces, activeWorkspace, switchWorkspace,
    isWorkspaceModalOpen, newWorkspaceName, setNewWorkspaceName,
    openWorkspaceModal, closeWorkspaceModal, confirmCreateWorkspace, deleteWorkspace,
    handleFileUpload,
    mockLoading,
    handleGenerateMockData,
  };
}