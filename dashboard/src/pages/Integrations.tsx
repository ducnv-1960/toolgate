import { useState, useEffect, useCallback } from "react";

interface IntegrationStatus {
  path: string;
  exists: boolean;
  configured: boolean;
  url?: string;
  samePort: boolean;
}

interface IntegrationsData {
  hubUrl: string;
  vscode: IntegrationStatus;
  claudeCode: IntegrationStatus;
}

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2 py-1 rounded transition-colors ${
        copied
          ? "bg-green-800/60 text-green-300"
          : "bg-gray-700 hover:bg-gray-600 text-gray-300"
      } ${className}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function IntegrationCard({
  title,
  icon,
  status,
  hubUrl,
  rawConfig,
  onAdd,
  onRemove,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  hubUrl: string;
  rawConfig: string;
  onAdd: () => void;
  onRemove: () => void;
  loading: boolean;
}) {
  const isReady = status.configured && status.samePort;
  const isStale = status.configured && !status.samePort;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{icon}</div>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{status.path}</p>
          </div>
        </div>
        <StatusBadge configured={isReady} stale={isStale} />
      </div>

      {status.configured && (
        <div className="mb-4 bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-400 flex items-center gap-2">
          <span className="text-gray-600">url:</span>
          <span className={isStale ? "text-yellow-400" : "text-green-400"}>
            {status.url}
          </span>
          {isStale && (
            <span className="text-yellow-500 ml-auto">
              ⚠ port mismatch (hub: {hubUrl})
            </span>
          )}
        </div>
      )}

      {!status.configured && (
        <p className="text-sm text-gray-500 mb-4">
          Toolgate is not registered yet. Click below to add it automatically.
        </p>
      )}

      <div className="flex gap-2">
        {!isReady ? (
          <button
            onClick={onAdd}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? "Updating..." : isStale ? "Update URL" : "Add to config"}
          </button>
        ) : (
          <button
            onClick={onRemove}
            disabled={loading}
            className="bg-red-900/40 hover:bg-red-900/70 disabled:opacity-50 text-red-400 text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? "Removing..." : "Remove from config"}
          </button>
        )}
      </div>

      {isReady && (
        <p className="text-xs text-green-500 mt-3">
          Restart VS Code / Claude Code to apply the change.
        </p>
      )}

      {/* Raw config section */}
      <div className="mt-4 border-t border-gray-700 pt-4">
        <p className="text-xs text-gray-400 mb-2">Manual config (JSON)</p>
        <div className="relative">
          <pre className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">
            {rawConfig}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={rawConfig} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  configured,
  stale,
}: {
  configured: boolean;
  stale: boolean;
}) {
  if (stale)
    return (
      <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-700 px-2 py-1 rounded-full">
        Port mismatch
      </span>
    );
  if (configured)
    return (
      <span className="text-xs bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 rounded-full">
        Registered
      </span>
    );
  return (
    <span className="text-xs bg-gray-700 text-gray-400 border border-gray-600 px-2 py-1 rounded-full">
      Not registered
    </span>
  );
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/integrations");
    setData(await res.json());
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleAction(
    target: "vscode" | "claude-code",
    action: "add" | "remove"
  ) {
    setLoading((l) => ({ ...l, [target]: true }));
    await fetch(`/api/integrations/${target}`, {
      method: action === "add" ? "POST" : "DELETE",
    });
    await fetchStatus();
    setLoading((l) => ({ ...l, [target]: false }));
  }

  if (!data) return <p className="text-gray-400">Loading...</p>;

  const vsCodeRaw = JSON.stringify(
    { servers: { "toolgate": { type: "http", url: data.hubUrl } } },
    null,
    2
  );
  const claudeCodeRaw = JSON.stringify(
    { mcpServers: { "toolgate": { type: "http", url: data.hubUrl } } },
    null,
    2
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Integrations</h1>
        <p className="text-gray-400 text-sm">
          Automatically register Toolgate in VS Code or Claude Code so it loads on startup.
        </p>
      </div>

      {/* Hub URL info */}
      <div className="bg-indigo-950/50 border border-indigo-800 rounded-xl p-4 mb-8 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-indigo-400 font-medium mb-1">Toolgate URL (current)</p>
          <p className="font-mono text-sm text-indigo-200">{data.hubUrl}</p>
        </div>
        <CopyButton text={data.hubUrl} className="bg-indigo-900/50 hover:bg-indigo-800/60 text-indigo-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <IntegrationCard
          title="VS Code"
          icon="⬡"
          status={data.vscode}
          hubUrl={data.hubUrl}
          rawConfig={vsCodeRaw}
          loading={!!loading["vscode"]}
          onAdd={() => handleAction("vscode", "add")}
          onRemove={() => handleAction("vscode", "remove")}
        />
        <IntegrationCard
          title="Claude Code"
          icon="◆"
          status={data.claudeCode}
          hubUrl={data.hubUrl}
          rawConfig={claudeCodeRaw}
          loading={!!loading["claude-code"]}
          onAdd={() => handleAction("claude-code", "add")}
          onRemove={() => handleAction("claude-code", "remove")}
        />
      </div>

      <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Notes</h3>
        <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
          <li>After adding the config, <strong className="text-gray-200">restart</strong> VS Code or Claude Code for it to take effect.</li>
          <li>Toolgate must be running before VS Code / Claude Code starts for the connection to succeed.</li>
          <li>If you change the port, click <strong className="text-gray-200">Update URL</strong> then restart the client.</li>
          <li>Config is written to the user-level (global) settings file and applies to all projects.</li>
        </ul>
      </div>
    </div>
  );
}
