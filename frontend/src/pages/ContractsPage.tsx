import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { contracts as contractsApi, groups as groupsApi, ApiError } from '@/lib/api';
import type { ContractResponse, ContractVersion, GroupSummary } from '@/types/api';
import {
  FileText,
  Save,
  Send,
  History,
  Eye,
  Edit3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type Tab = 'editor' | 'versions';

export default function ContractsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [tab, setTab] = useState<Tab>('editor');
  const [contractData, setContractData] = useState<ContractResponse | null>(null);
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editor state
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Versions
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const fetchContract = useCallback(async () => {
    if (!groupId) return;
    try {
      const [data, groupData] = await Promise.all([
        contractsApi.get(groupId),
        groupsApi.get(groupId),
      ]);
      setContractData(data);
      setGroup(groupData);
      setDraftContent(data.contract.draftContent);
      setDirty(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load contract');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchVersions = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await contractsApi.listVersions(groupId, { pageSize: 50 });
      setVersions(data.versions);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }, [groupId]);

  useEffect(() => {
    fetchContract();
    fetchVersions();
  }, [fetchContract, fetchVersions]);

  const isAdmin = group?.memberRole === 'ADMIN';

  const handleSaveDraft = async () => {
    if (!groupId) return;
    setSaving(true);
    setError('');
    try {
      await contractsApi.updateDraft(groupId, draftContent);
      setDirty(false);
      fetchContract();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!groupId) return;
    if (!window.confirm('Publish the current draft as a new version? This cannot be undone.'))
      return;

    setPublishing(true);
    setError('');
    try {
      // Save first if dirty
      if (dirty) {
        await contractsApi.updateDraft(groupId, draftContent);
      }
      await contractsApi.publish(groupId);
      fetchContract();
      fetchVersions();
      setDirty(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Group Contract</h1>
        <p className="mt-1 text-sm text-gray-500">
          {contractData?.contract.publishedVersion
            ? `Published v${contractData.contract.publishedVersion}`
            : 'No published version yet'}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-gray-200">
        <button
          onClick={() => setTab('editor')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === 'editor'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            {isAdmin ? <Edit3 size={16} /> : <Eye size={16} />}
            {isAdmin ? 'Draft Editor' : 'View Draft'}
          </span>
        </button>
        <button
          onClick={() => setTab('versions')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === 'versions'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <History size={16} />
            Version History ({versions.length})
          </span>
        </button>
      </div>

      {tab === 'editor' && (
        <div>
          {/* Published content preview */}
          {contractData?.latestPublishedContent && (
            <div className="mb-4 card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Latest Published (v{contractData.contract.publishedVersion})
                </span>
              </div>
              <div className="prose prose-sm max-w-none rounded-lg bg-green-50 p-4 text-gray-700 whitespace-pre-wrap">
                {contractData.latestPublishedContent}
              </div>
            </div>
          )}

          {/* Draft editor */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Draft</span>
                {dirty && <span className="badge-yellow">Unsaved changes</span>}
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDraft}
                    className="btn-secondary btn-sm"
                    disabled={saving || !dirty}
                  >
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    onClick={handlePublish}
                    className="btn-primary btn-sm"
                    disabled={publishing || (!draftContent.trim() && !dirty)}
                  >
                    <Send size={14} />
                    {publishing ? 'Publishing...' : 'Publish'}
                  </button>
                </div>
              )}
            </div>

            {isAdmin ? (
              <textarea
                className="input min-h-[400px] resize-y font-mono text-sm"
                value={draftContent}
                onChange={(e) => {
                  setDraftContent(e.target.value);
                  setDirty(true);
                }}
                placeholder="Write your roommate contract here...

Examples of things to include:
- Quiet hours
- Guest policy
- Cleaning schedule
- Shared expenses rules
- Kitchen/bathroom usage
- Pet policy
- Move-out notice period"
              />
            ) : (
              <div className="rounded-lg bg-gray-50 p-4 min-h-[200px] whitespace-pre-wrap text-sm text-gray-700">
                {draftContent || (
                  <span className="text-gray-400 italic">No draft content yet</span>
                )}
              </div>
            )}

            {!isAdmin && (
              <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                Only admins can edit the contract draft
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'versions' && (
        <div>
          {versions.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <History className="mb-4 h-12 w-12 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">No published versions</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin
                  ? 'Write a draft and publish it to create the first version'
                  : 'The admin has not published any contract versions yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="card">
                  <button
                    className="flex w-full items-center justify-between p-4 text-left"
                    onClick={() =>
                      setExpandedVersion(expandedVersion === v.version ? null : v.version)
                    }
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Version {v.version}</span>
                        {v.version === contractData?.contract.publishedVersion && (
                          <span className="badge-green">Latest</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Published {format(parseISO(v.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {expandedVersion === v.version ? (
                      <ChevronUp size={18} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </button>

                  {expandedVersion === v.version && (
                    <div className="border-t border-gray-100 p-4">
                      <div className="rounded-lg bg-gray-50 p-4 whitespace-pre-wrap text-sm text-gray-700">
                        {v.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
