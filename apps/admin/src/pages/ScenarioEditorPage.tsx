import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import RichTextEditor from '../components/RichTextEditor';
import { useAuth } from '../hooks/useAuth';

interface Position {
  x: number;
  y: number;
}

// 応答メッセージの型
interface ResponseMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'file';
  content: string;
  imageUrl?: string;
}

// 分岐条件の型
interface BranchCondition {
  id: string;
  type: 'button' | 'link' | 'jump' | 'text_input';
  label: string;
  // ボタン/リンク用
  nextNodeId?: string;
  // リンク用
  url?: string;
  openInNewWindow?: boolean;
  // ジャンプ用
  targetNodeName?: string;
}

// ノードの詳細設定
interface NodeSettings {
  nodeName?: string;           // ノード名（ジャンプ先として参照）
  rememberResponse?: boolean;  // 発言内容の記憶
  isCvPoint?: boolean;         // CVポイント
  directTransition?: boolean;  // 直接遷移
  directTransitionText?: string; // 直接遷移時の会話文
  freeInputMode?: 'default' | 'enabled' | 'disabled'; // 自由入力欄
}

interface ScenarioNode {
  id: string;
  type: 'start' | 'message' | 'question' | 'condition' | 'action' | 'end';
  position: Position;
  data: {
    label: string;
    // 複数の応答メッセージ
    responses?: ResponseMessage[];
    // 分岐条件（ボタン、リンク、ジャンプ）
    branches?: BranchCondition[];
    // レガシー互換
    content?: string;
    options?: { id: string; label: string; nextNodeId?: string }[];
    condition?: string;
    action?: string;
  };
  // ノード設定
  settings?: NodeSettings;
  nextNodeId?: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
}

const nodeTypes = [
  { type: 'start', label: '開始', color: 'bg-green-500', icon: '▶' },
  { type: 'message', label: 'メッセージ', color: 'bg-blue-500', icon: '💬' },
  { type: 'question', label: '質問', color: 'bg-purple-500', icon: '❓' },
  { type: 'condition', label: '条件分岐', color: 'bg-yellow-500', icon: '⚡' },
  { type: 'action', label: 'アクション', color: 'bg-orange-500', icon: '⚙' },
  { type: 'end', label: '終了', color: 'bg-red-500', icon: '⏹' },
];

const branchTypes = [
  { type: 'button', label: 'ボタン' },
  { type: 'link', label: 'リンクボタン' },
  { type: 'jump', label: '他ノードへの移動' },
  { type: 'text_input', label: 'テキスト入力' },
];

// ターゲットロールの選択肢
const targetRoleOptions = [
  { value: '', label: '全員対象' },
  { value: 'learner', label: '受講者' },
  { value: 'group_admin', label: 'グループ管理者' },
  { value: 'global_admin', label: '全体管理者' },
];

export default function ScenarioEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<ScenarioNode[]>([
    {
      id: 'start-1',
      type: 'start',
      position: { x: 100, y: 100 },
      data: { label: '開始' },
    },
  ]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<ScenarioNode | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle?: string } | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [scenarioName, setScenarioName] = useState('新しいシナリオ');
  const [targetRole, setTargetRole] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pan, _setPan] = useState<Position>({ x: 0, y: 0 });
  const [showNodeSettings, setShowNodeSettings] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchScenario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // 最新の状態を参照するためのref
  const draggingNodeRef = useRef(draggingNode);
  const connectingFromRef = useRef(connectingFrom);
  const dragOffsetRef = useRef(dragOffset);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // refを最新に保つ
  useEffect(() => {
    draggingNodeRef.current = draggingNode;
  }, [draggingNode]);

  useEffect(() => {
    connectingFromRef.current = connectingFrom;
  }, [connectingFrom]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // グローバルなマウスイベントでドラッグ/接続を終了
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // ドラッグ中またはコネクト中の場合のみ処理
      if (draggingNodeRef.current || connectingFromRef.current) {
        setDraggingNode(null);
        setConnectingFrom(null);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 接続中のマウス位置を追跡
      if (connectingFromRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
        setMousePos({ x, y });
      }

      if (draggingNodeRef.current) {
        const newX = (e.clientX - dragOffsetRef.current.x - panRef.current.x) / zoomRef.current;
        const newY = (e.clientY - dragOffsetRef.current.y - panRef.current.y) / zoomRef.current;

        setNodes((prev) =>
          prev.map((node) =>
            node.id === draggingNodeRef.current
              ? { ...node, position: { x: newX, y: newY } }
              : node
          )
        );
      }
    };

    // capture: true でイベントをキャプチャフェーズで捕捉（stopPropagationより先に処理される）
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp, true);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []); // 空の依存配列 - 一度だけ登録

  const fetchScenario = async () => {
    try {
      const res = await fetch(`/api/scenarios/scenario/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScenarioName(data.name || '');
        setTargetRole(data.targetRole || '');

        // ノードを復元
        if (data.nodes && Array.isArray(data.nodes)) {
          const parsedNodes = data.nodes.map((node: { id: string; type: string; metadata?: string; content?: string; position?: Position; data?: ScenarioNode['data']; settings?: NodeSettings }) => {
            // 新形式（position, data, settingsが直接含まれる）
            if (node.position && node.data) {
              return {
                id: node.id,
                type: node.type || 'message',
                position: node.position,
                data: node.data,
                settings: node.settings,
              };
            }
            // 旧形式（metadataがJSON文字列）
            const metadata = node.metadata ? JSON.parse(node.metadata) : {};
            return {
              id: node.id,
              type: metadata.nodeType || node.type || 'message',
              position: metadata.position || { x: 200, y: 200 },
              data: {
                label: metadata.label || node.type,
                content: node.content,
                options: metadata.options,
                condition: metadata.condition,
                action: metadata.action,
                responses: metadata.responses,
                branches: metadata.branches,
              },
              settings: metadata.settings,
              nextNodeId: metadata.nextNodeId,
            };
          });
          if (parsedNodes.length > 0) {
            setNodes(parsedNodes);
          }
        }

        // 接続（connections）を復元
        if (data.connections && Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
      }
    } catch (err) {
      console.error('Failed to fetch scenario:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isNew = !id || id === 'new';
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew
        ? '/api/scenarios/scenario'
        : `/api/scenarios/scenario/${id}`;

      // 新形式でノードデータを保存
      const scenarioData = {
        name: scenarioName,
        targetRole: targetRole || null, // 空文字列はnullとして送信（全員対象）
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          settings: node.settings,
          content: node.data.content || node.data.responses?.[0]?.content || '',
          metadata: JSON.stringify({
            nodeType: node.type,
            position: node.position,
            label: node.data.label,
            options: node.data.options,
            nextNodeId: node.nextNodeId,
            condition: node.data.condition,
            action: node.data.action,
            responses: node.data.responses,
            branches: node.data.branches,
            settings: node.settings,
          }),
        })),
        connections: connections,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scenarioData),
      });

      if (res.ok) {
        const data = await res.json();
        alert('保存しました');
        if (isNew && data.id) {
          navigate(`/scenarios/${data.id}/edit`);
        }
      } else {
        const errorData = await res.json();
        alert(`保存に失敗しました: ${errorData.message || 'エラーが発生しました'}`);
      }
    } catch (err) {
      console.error('Failed to save:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const addNode = (type: ScenarioNode['type']) => {
    const newNode: ScenarioNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: {
        label: nodeTypes.find((t) => t.type === type)?.label || type,
        responses: type === 'message' || type === 'question' ? [{ id: '1', type: 'text', content: '' }] : undefined,
        branches: type === 'question' ? [
          { id: '1', type: 'button', label: 'はい' },
          { id: '2', type: 'button', label: 'いいえ' },
        ] : undefined,
      },
      settings: {
        freeInputMode: 'default',
      },
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
  };

  const deleteNode = (nodeId: string) => {
    if (nodeId.startsWith('start')) {
      alert('開始ノードは削除できません');
      return;
    }
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setConnections(connections.filter((c) => c.sourceId !== nodeId && c.targetId !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  // ノードの最新の位置を取得するためのref
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault(); // ドラッグ中のテキスト選択を防ぐ
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggingNode(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x * zoomRef.current - panRef.current.x,
      y: e.clientY - node.position.y * zoomRef.current - panRef.current.y,
    });
    setSelectedNode(node);
  }, []);

  const startConnection = (nodeId: string, handle?: string) => {
    setConnectingFrom({ nodeId, handle });
  };

  const endConnection = (targetId: string) => {
    if (connectingFrom && connectingFrom.nodeId !== targetId) {
      const existingConnection = connections.find(
        (c) => c.sourceId === connectingFrom.nodeId && c.sourceHandle === connectingFrom.handle
      );
      if (existingConnection) {
        setConnections(connections.filter((c) => c.id !== existingConnection.id));
      }

      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        sourceId: connectingFrom.nodeId,
        targetId,
        sourceHandle: connectingFrom.handle,
      };
      setConnections([...connections, newConnection]);
    }
    setConnectingFrom(null);
  };

  const updateNodeData = (nodeId: string, data: Partial<ScenarioNode['data']>) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
    }
  };

  const updateNodeSettings = (nodeId: string, settings: Partial<NodeSettings>) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, settings: { ...node.settings, ...settings } } : node
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, settings: { ...prev.settings, ...settings } } : null);
    }
  };

  // 応答メッセージ操作
  const addResponse = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newResponse: ResponseMessage = {
      id: String(Date.now()),
      type: 'text',
      content: '',
    };
    updateNodeData(nodeId, {
      responses: [...(node.data.responses || []), newResponse],
    });
  };

  const updateResponse = (nodeId: string, responseId: string, updates: Partial<ResponseMessage>) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, {
      responses: node.data.responses?.map((r) =>
        r.id === responseId ? { ...r, ...updates } : r
      ),
    });
  };

  const deleteResponse = (nodeId: string, responseId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || (node.data.responses?.length || 0) <= 1) return;
    updateNodeData(nodeId, {
      responses: node.data.responses?.filter((r) => r.id !== responseId),
    });
  };

  const moveResponse = (nodeId: string, responseId: string, direction: 'up' | 'down') => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.data.responses) return;
    const idx = node.data.responses.findIndex((r) => r.id === responseId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === node.data.responses.length - 1) return;
    const newResponses = [...node.data.responses];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newResponses[idx], newResponses[swapIdx]] = [newResponses[swapIdx], newResponses[idx]];
    updateNodeData(nodeId, { responses: newResponses });
  };

  // 分岐条件操作
  const addBranch = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newBranch: BranchCondition = {
      id: String(Date.now()),
      type: 'button',
      label: '新しい選択肢',
    };
    updateNodeData(nodeId, {
      branches: [...(node.data.branches || []), newBranch],
    });
  };

  const updateBranch = (nodeId: string, branchId: string, updates: Partial<BranchCondition>) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, {
      branches: node.data.branches?.map((b) =>
        b.id === branchId ? { ...b, ...updates } : b
      ),
    });
  };

  const deleteBranch = (nodeId: string, branchId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNodeData(nodeId, {
      branches: node.data.branches?.filter((b) => b.id !== branchId),
    });
  };

  const getNodeColor = (type: ScenarioNode['type']) => {
    return nodeTypes.find((t) => t.type === type)?.color || 'bg-gray-500';
  };

  const getNodeIcon = (type: ScenarioNode['type']) => {
    return nodeTypes.find((t) => t.type === type)?.icon || '?';
  };

  // ノード名一覧を取得（ジャンプ先選択用）
  const getNodeNames = () => {
    return nodes
      .filter((n) => n.settings?.nodeName)
      .map((n) => ({ id: n.id, name: n.settings!.nodeName! }));
  };

  const renderConnections = () => {
    return connections.map((conn) => {
      const sourceNode = nodes.find((n) => n.id === conn.sourceId);
      const targetNode = nodes.find((n) => n.id === conn.targetId);
      if (!sourceNode || !targetNode) return null;

      // ノード幅は192px (w-48)、高さは約80px
      const NODE_WIDTH = 192;
      const NODE_HEIGHT = 80;

      const x1 = sourceNode.position.x + NODE_WIDTH; // 右端から出る
      const y1 = sourceNode.position.y + NODE_HEIGHT / 2; // 中央
      const x2 = targetNode.position.x; // 左端に入る
      const y2 = targetNode.position.y + NODE_HEIGHT / 2; // 中央

      // ベジェ曲線の制御点を計算
      const dx = Math.abs(x2 - x1);
      const controlOffset = Math.max(50, dx * 0.4);

      return (
        <g key={conn.id}>
          <path
            d={`M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`}
            stroke="#6B7280"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    });
  };

  // 接続中の仮の線をレンダリング
  const renderConnectingLine = () => {
    if (!connectingFrom) return null;
    const sourceNode = nodes.find((n) => n.id === connectingFrom.nodeId);
    if (!sourceNode) return null;

    const NODE_WIDTH = 192;
    const NODE_HEIGHT = 80;

    const x1 = sourceNode.position.x + NODE_WIDTH; // ノードの右端
    const y1 = sourceNode.position.y + NODE_HEIGHT / 2;  // ノードの中央
    const x2 = mousePos.x;
    const y2 = mousePos.y;

    // ベジェ曲線の制御点を計算
    const dx = Math.abs(x2 - x1);
    const controlOffset = Math.max(50, dx * 0.4);

    return (
      <path
        d={`M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`}
        stroke="#3B82F6"
        strokeWidth="2"
        strokeDasharray="5,5"
        fill="none"
        className="pointer-events-none"
      />
    );
  };

  // ノード設定パネル（モーダル風）
  const renderNodeSettingsPanel = () => {
    if (!selectedNode || !showNodeSettings) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] overflow-hidden">
          {/* ヘッダー */}
          <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">対話ノード設定</h2>
            <button
              onClick={() => setShowNodeSettings(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* コンテンツ */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* 応答文セクション - EVA風UI */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs">応答文</span>
              </h3>

              <div className="space-y-4">
                {selectedNode.data.responses?.map((response, idx) => (
                  <div key={response.id} className="border border-gray-300 rounded-lg overflow-hidden">
                    {/* 応答タイプヘッダー */}
                    <div className="bg-gray-100 px-3 py-2 border-b border-gray-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">応答タイプ</span>
                        <select
                          value={response.type}
                          onChange={(e) => updateResponse(selectedNode.id, response.id, { type: e.target.value as ResponseMessage['type'] })}
                          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="text">Web - テキストメッセージ</option>
                          <option value="image">画像</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveResponse(selectedNode.id, response.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                          title="上へ移動"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveResponse(selectedNode.id, response.id, 'down')}
                          disabled={idx === (selectedNode.data.responses?.length || 0) - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                          title="下へ移動"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteResponse(selectedNode.id, response.id)}
                          disabled={(selectedNode.data.responses?.length || 0) <= 1}
                          className="p-1 hover:bg-gray-200 rounded text-red-500 disabled:opacity-30"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* コンテンツ部分 */}
                    <div className="p-3">
                      {response.type === 'image' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-24 flex-shrink-0">画像アップロード</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const formData = new FormData();
                                formData.append('file', file);
                                try {
                                  const res = await fetch('/api/uploads/scenario-image', {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                    body: formData,
                                  });
                                  const result = await res.json();
                                  if (result.success && result.imageUrl) {
                                    updateResponse(selectedNode.id, response.id, { imageUrl: result.imageUrl });
                                  } else {
                                    alert('画像のアップロードに失敗しました');
                                  }
                                } catch {
                                  alert('画像のアップロード中にエラーが発生しました');
                                }
                              }}
                              className="flex-1 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-24 flex-shrink-0">またはURL入力</span>
                            <input
                              type="text"
                              value={response.imageUrl || ''}
                              onChange={(e) => updateResponse(selectedNode.id, response.id, { imageUrl: e.target.value })}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="https://..."
                            />
                          </div>
                          {response.imageUrl && (
                            <div className="border border-gray-200 rounded p-2 bg-gray-50">
                              <img
                                src={response.imageUrl}
                                alt="プレビュー"
                                className="max-h-40 object-contain mx-auto"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <RichTextEditor
                          value={response.content}
                          onChange={(newContent) => updateResponse(selectedNode.id, response.id, { content: newContent })}
                          onImageUpload={async (file) => {
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              const res = await fetch('/api/uploads/scenario-image', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                                body: formData,
                              });
                              const result = await res.json();
                              if (result.success && result.imageUrl) {
                                return result.imageUrl;
                              }
                            } catch {
                              alert('画像のアップロード中にエラーが発生しました');
                            }
                            return null;
                          }}
                          placeholder="応答メッセージを入力..."
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addResponse(selectedNode.id)}
                className="mt-3 px-4 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                + 応答文を追加
              </button>
            </div>

            {/* 応答ボタンセクション - EVA風UI */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs">応答ボタン</span>
              </h3>

              <div className="space-y-3">
                {selectedNode.data.branches?.map((branch, idx) => (
                  <div key={branch.id} className="border border-gray-300 rounded-lg overflow-hidden">
                    {/* ボタンタイプヘッダー */}
                    <div className="bg-gray-100 px-3 py-2 border-b border-gray-300 flex items-center justify-between">
                      <select
                        value={branch.type}
                        onChange={(e) => updateBranch(selectedNode.id, branch.id, { type: e.target.value as BranchCondition['type'] })}
                        className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                      >
                        {branchTypes.map((bt) => (
                          <option key={bt.type} value={bt.type}>{bt.label}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (!selectedNode.data.branches || idx === 0) return;
                            const newBranches = [...selectedNode.data.branches];
                            [newBranches[idx], newBranches[idx - 1]] = [newBranches[idx - 1], newBranches[idx]];
                            updateNodeData(selectedNode.id, { branches: newBranches });
                          }}
                          disabled={idx === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                          title="上へ移動"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (!selectedNode.data.branches || idx === selectedNode.data.branches.length - 1) return;
                            const newBranches = [...selectedNode.data.branches];
                            [newBranches[idx], newBranches[idx + 1]] = [newBranches[idx + 1], newBranches[idx]];
                            updateNodeData(selectedNode.id, { branches: newBranches });
                          }}
                          disabled={idx === (selectedNode.data.branches?.length || 0) - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                          title="下へ移動"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteBranch(selectedNode.id, branch.id)}
                          className="p-1 hover:bg-gray-200 rounded text-red-500"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ボタン設定コンテンツ */}
                    <div className="p-3 space-y-2">
                      {/* テキスト入力（全タイプ共通） */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">テキスト</span>
                        <input
                          type="text"
                          value={branch.label}
                          onChange={(e) => updateBranch(selectedNode.id, branch.id, { label: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="ボタンに表示するテキスト"
                        />
                      </div>

                      {/* ボタンタイプ別の追加フィールド */}
                      {branch.type === 'button' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">ノード名</span>
                          <select
                            value={branch.nextNodeId || ''}
                            onChange={(e) => updateBranch(selectedNode.id, branch.id, { nextNodeId: e.target.value || undefined })}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            <option value="">（接続先で指定）</option>
                            {getNodeNames().map((n) => (
                              <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {branch.type === 'link' && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">URL</span>
                            <input
                              type="text"
                              value={branch.url || ''}
                              onChange={(e) => updateBranch(selectedNode.id, branch.id, { url: e.target.value })}
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                              placeholder="https://..."
                            />
                          </div>
                          <div className="flex items-center gap-2 pl-[88px]">
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!branch.openInNewWindow}
                                onChange={(e) => updateBranch(selectedNode.id, branch.id, { openInNewWindow: !e.target.checked })}
                                className="rounded border-gray-300"
                              />
                              同一ウィンドウで開く
                            </label>
                          </div>
                        </>
                      )}

                      {branch.type === 'jump' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">ノード名</span>
                          <select
                            value={branch.targetNodeName || ''}
                            onChange={(e) => updateBranch(selectedNode.id, branch.id, { targetNodeName: e.target.value || undefined })}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            <option value="">選択してください</option>
                            {getNodeNames().map((n) => (
                              <option key={n.id} value={n.name}>{n.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addBranch(selectedNode.id)}
                className="mt-3 px-4 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
              >
                追加
              </button>
            </div>

            {/* 詳細設定セクション */}
            <div className="border-t pt-6 space-y-4">
              {/* 発言内容の記憶 */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-32">発言内容の記憶</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedNode.settings?.rememberResponse || false}
                    onChange={(e) => updateNodeSettings(selectedNode.id, { rememberResponse: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600">この応答文に対するユーザの発言を記憶する</span>
                </label>
              </div>

              {/* ノード名 */}
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-700 w-32 pt-1">ノード名</span>
                <div className="flex-1">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={!!selectedNode.settings?.nodeName}
                      onChange={(e) => updateNodeSettings(selectedNode.id, {
                        nodeName: e.target.checked ? `ノード${selectedNode.id.slice(-4)}` : undefined
                      })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600">このノードに名前をつける</span>
                  </label>
                  {selectedNode.settings?.nodeName && (
                    <>
                      <p className="text-xs text-gray-500 mb-2">
                        この対話ノードに名前をつけることで、他のノードからこのノードへ矢印を引かずに遷移させることができるようになります。
                        大量のノードから特定のノードに遷移する場合などに、シナリオエディタが複雑になるのを防げます。
                      </p>
                      <input
                        type="text"
                        value={selectedNode.settings.nodeName}
                        onChange={(e) => updateNodeSettings(selectedNode.id, { nodeName: e.target.value })}
                        className="w-64 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="ノード名を入力"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* CVポイント */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-32">CVポイント</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedNode.settings?.isCvPoint || false}
                    onChange={(e) => updateNodeSettings(selectedNode.id, { isCvPoint: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600">コンバージョンポイントとして設定する</span>
                </label>
              </div>

              {/* 直接遷移 */}
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-700 w-32 pt-1">直接遷移</span>
                <div className="flex-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.settings?.directTransition || false}
                      onChange={(e) => updateNodeSettings(selectedNode.id, { directTransition: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600">このノードに直接遷移する会話文を設定する</span>
                  </label>
                  {selectedNode.settings?.directTransition && (
                    <input
                      type="text"
                      value={selectedNode.settings.directTransitionText || ''}
                      onChange={(e) => updateNodeSettings(selectedNode.id, { directTransitionText: e.target.value })}
                      className="mt-2 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="直接遷移のトリガーとなる会話文"
                    />
                  )}
                </div>
              </div>

              {/* 自由入力欄 */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-32">自由入力欄</span>
                <select
                  value={selectedNode.settings?.freeInputMode || 'default'}
                  onChange={(e) => updateNodeSettings(selectedNode.id, { freeInputMode: e.target.value as NodeSettings['freeInputMode'] })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="default">デフォルトの表示設定に従う</option>
                  <option value="enabled">表示する</option>
                  <option value="disabled">非表示</option>
                </select>
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="bg-gray-100 px-6 py-4 border-t flex justify-end gap-3">
            <button
              onClick={() => {
                if (confirm('このノードを削除しますか？')) {
                  deleteNode(selectedNode.id);
                  setShowNodeSettings(false);
                }
              }}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              disabled={selectedNode.type === 'start'}
            >
              削除
            </button>
            <button
              onClick={() => setShowNodeSettings(false)}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover text-sm"
            >
              設定
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/scenarios')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="text-xl font-bold text-gray-800 border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
              placeholder="シナリオ名"
            />
            <div className="flex items-center gap-2 ml-4">
              <label className="text-sm text-gray-600 whitespace-nowrap">対象:</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {targetRoleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="p-2 hover:bg-gray-200 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-sm text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                className="p-2 hover:bg-gray-200 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Node Palette */}
          <div className="w-48 bg-white border-r border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">ノード追加</h3>
            <div className="space-y-2">
              {nodeTypes.map((nodeType) => (
                <button
                  key={nodeType.type}
                  onClick={() => addNode(nodeType.type as ScenarioNode['type'])}
                  className={`w-full px-3 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity ${nodeType.color}`}
                >
                  <span>{nodeType.icon}</span>
                  <span>{nodeType.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="flex-1 bg-gray-100 overflow-auto relative"
            style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          >
            {/* スクロール可能なコンテナ */}
            <div
              style={{
                width: `${5000 * zoom}px`,
                height: `${3000 * zoom}px`,
                position: 'relative',
              }}
            >
              <svg
                className="absolute pointer-events-none"
                style={{
                  width: '5000px',
                  height: '3000px',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  overflow: 'visible'
                }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
                  </marker>
                </defs>
                {renderConnections()}
                {renderConnectingLine()}
              </svg>

              <div
                className="absolute inset-0"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
            >
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className={`absolute w-48 bg-white rounded-lg shadow-md border-2 cursor-move transition-shadow ${
                    selectedNode?.id === node.id ? 'border-primary shadow-lg' : 'border-transparent'
                  } ${connectingFrom ? 'hover:border-primary hover:shadow-lg' : ''}`}
                  style={{ left: node.position.x, top: node.position.y }}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                    setShowNodeSettings(true);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    if (connectingFrom && connectingFrom.nodeId !== node.id) {
                      endConnection(node.id);
                    }
                  }}
                >
                  {/* 入力ハンドル（左側） - startノード以外 */}
                  {node.type !== 'start' && (
                    <div
                      className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-gray-400 bg-white cursor-pointer hover:bg-blue-100 hover:border-blue-500 transition-colors ${
                        connectingFrom ? 'bg-blue-100 border-blue-500 scale-125' : ''
                      }`}
                      title="ここに接続"
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        endConnection(node.id);
                      }}
                    />
                  )}

                  {/* 出力ハンドル（右側） - endノード以外で、branchesがない場合 */}
                  {node.type !== 'end' && (!node.data.branches || node.data.branches.length === 0) && (!node.data.options || node.data.options.length === 0) && (
                    <div
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-gray-400 bg-white cursor-pointer hover:bg-green-100 hover:border-green-500 transition-colors ${
                        connectingFrom?.nodeId === node.id && !connectingFrom?.handle ? 'bg-green-300 border-green-600' : ''
                      }`}
                      title="ドラッグして接続"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        startConnection(node.id);
                      }}
                    />
                  )}

                  {/* Node Header */}
                  <div className={`px-3 py-2 rounded-t-lg flex items-center gap-2 ${getNodeColor(node.type)}`}>
                    <span className="text-white">{getNodeIcon(node.type)}</span>
                    <span className="text-white text-sm font-medium truncate flex-1">{node.data.label}</span>
                    {node.type !== 'start' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        className="text-white/70 hover:text-white"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Node Content Preview */}
                  <div className="px-3 py-2">
                    {/* 応答メッセージのプレビュー */}
                    {node.data.responses && node.data.responses.length > 0 && (
                      <p className="text-xs text-gray-600 truncate">
                        {node.data.responses[0].content || '(空のメッセージ)'}
                      </p>
                    )}
                    {/* レガシー互換 */}
                    {!node.data.responses && node.data.content && (
                      <p className="text-xs text-gray-600 truncate">{node.data.content}</p>
                    )}
                    {/* 分岐条件のプレビュー */}
                    {node.data.branches && node.data.branches.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {node.data.branches.slice(0, 3).map((branch) => (
                          <div
                            key={branch.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-gray-600 truncate">{branch.label}</span>
                            <div
                              className="w-3 h-3 bg-gray-300 rounded-full cursor-pointer hover:bg-primary flex-shrink-0"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startConnection(node.id, branch.id);
                              }}
                              onMouseUp={(e) => {
                                e.stopPropagation();
                                endConnection(node.id);
                              }}
                            />
                          </div>
                        ))}
                        {node.data.branches.length > 3 && (
                          <p className="text-xs text-gray-400">+{node.data.branches.length - 3} more</p>
                        )}
                      </div>
                    )}
                    {/* レガシー互換: options */}
                    {!node.data.branches && node.data.options && (
                      <div className="mt-2 space-y-1">
                        {node.data.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-gray-600">{opt.label}</span>
                            <div
                              className="w-3 h-3 bg-gray-300 rounded-full cursor-pointer hover:bg-primary"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startConnection(node.id, opt.id);
                              }}
                              onMouseUp={(e) => {
                                e.stopPropagation();
                                endConnection(node.id);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* ノード名バッジ */}
                    {node.settings?.nodeName && (
                      <div className="mt-2">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                          {node.settings.nodeName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Connection Handles */}
                  {node.type !== 'start' && (
                    <div
                      className="absolute -left-2 top-1/2 w-4 h-4 bg-gray-300 rounded-full cursor-pointer hover:bg-primary transform -translate-y-1/2"
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        endConnection(node.id);
                      }}
                    />
                  )}
                  {node.type !== 'end' && !node.data.branches && !node.data.options && (
                    <div
                      className="absolute -right-2 top-1/2 w-4 h-4 bg-gray-300 rounded-full cursor-pointer hover:bg-primary transform -translate-y-1/2"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        startConnection(node.id);
                      }}
                    />
                  )}
                </div>
              ))}
              </div>
            </div>
          </div>

          {/* Properties Panel (Simple) */}
          {selectedNode && !showNodeSettings && (
            <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">プロパティ</h3>
                <button
                  onClick={() => setShowNodeSettings(true)}
                  className="text-sm text-primary hover:text-primary-hover"
                >
                  詳細設定
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ラベル</label>
                  <input
                    type="text"
                    value={selectedNode.data.label}
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                {/* 簡易メッセージ入力 */}
                {(selectedNode.type === 'message' || selectedNode.type === 'question') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      メッセージ
                      {selectedNode.data.responses && selectedNode.data.responses.length > 1 && (
                        <span className="text-gray-400 ml-1">
                          ({selectedNode.data.responses.length}件)
                        </span>
                      )}
                    </label>
                    <textarea
                      value={selectedNode.data.responses?.[0]?.content || selectedNode.data.content || ''}
                      onChange={(e) => {
                        if (selectedNode.data.responses && selectedNode.data.responses.length > 0) {
                          updateResponse(selectedNode.id, selectedNode.data.responses[0].id, { content: e.target.value });
                        } else {
                          updateNodeData(selectedNode.id, { content: e.target.value });
                        }
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      placeholder="ボットが表示するメッセージを入力..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      複数メッセージ・分岐条件は「詳細設定」から編集できます
                    </p>
                  </div>
                )}

                {selectedNode.type === 'condition' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">条件式</label>
                    <textarea
                      value={selectedNode.data.condition || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                      placeholder="user.name === '太郎'"
                    />
                  </div>
                )}

                {selectedNode.type === 'action' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">アクション</label>
                    <select
                      value={selectedNode.data.action || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { action: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="">選択してください</option>
                      <option value="transfer_human">有人対応に切替</option>
                      <option value="send_email">メール送信</option>
                      <option value="send_slack">Slack通知</option>
                      <option value="save_data">データ保存</option>
                      <option value="api_call">API呼び出し</option>
                    </select>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    ノードID: {selectedNode.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    タイプ: {selectedNode.type}
                  </p>
                  {selectedNode.settings?.nodeName && (
                    <p className="text-xs text-gray-500">
                      ノード名: {selectedNode.settings.nodeName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Settings Modal */}
      {renderNodeSettingsPanel()}
    </Layout>
  );
}
