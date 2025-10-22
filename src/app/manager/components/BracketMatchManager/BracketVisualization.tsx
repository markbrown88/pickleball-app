'use client';

/**
 * Bracket Visualization Component
 *
 * Uses React Flow with Dagre layout to display tournament bracket as a flow diagram.
 * Shows winner bracket, loser bracket, and finals in a hierarchical layout.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Position,
  MarkerType,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { BracketMatchNode } from './BracketMatchNode';
import { BracketMatchModal } from './BracketMatchModal';

interface Round {
  id: string;
  idx: number;
  bracketType: string | null;
  depth: number | null;
  matches: Match[];
}

interface Match {
  id: string;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
  seedA: number | null;
  seedB: number | null;
  isBye: boolean;
  winnerId: string | null;
  games: Game[];
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean;
  startedAt: string | null;
}

interface BracketVisualizationProps {
  rounds: Round[];
  onMatchUpdate?: () => void;
  onError?: (message: string) => void;
  onInfo?: (message: string) => void;
}

// Node width and height constants
const NODE_WIDTH = 280;
const NODE_HEIGHT = 120;

// Dagre graph setup
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Custom node types
const nodeTypes = {
  matchNode: BracketMatchNode,
};

/**
 * Calculate layout using Dagre
 */
function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 200,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };

    return newNode;
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Convert bracket rounds to React Flow nodes and edges
 */
function convertRoundsToFlow(rounds: Round[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Sort rounds by bracket type and depth
  const sortedRounds = [...rounds].sort((a, b) => {
    // Order: WINNER -> LOSER -> FINALS
    const typeOrder = { WINNER: 0, LOSER: 1, FINALS: 2 };
    const typeA = typeOrder[a.bracketType as keyof typeof typeOrder] ?? 999;
    const typeB = typeOrder[b.bracketType as keyof typeof typeOrder] ?? 999;

    if (typeA !== typeB) return typeA - typeB;

    // Within same bracket type, sort by depth (descending for winner/loser brackets)
    if (a.bracketType === 'FINALS' || b.bracketType === 'FINALS') {
      return 0;
    }
    return (b.depth ?? 0) - (a.depth ?? 0);
  });

  // Create nodes for each match
  sortedRounds.forEach((round) => {
    round.matches.forEach((match, matchIdx) => {
      const nodeId = match.id;

      // Determine node color based on bracket type
      let nodeBorderColor = '#3b82f6'; // blue for winner
      if (round.bracketType === 'LOSER') {
        nodeBorderColor = '#f97316'; // orange for loser
      } else if (round.bracketType === 'FINALS') {
        nodeBorderColor = '#eab308'; // yellow for finals
      }

      nodes.push({
        id: nodeId,
        type: 'matchNode',
        position: { x: 0, y: 0 }, // Will be calculated by Dagre
        data: {
          match,
          round,
          borderColor: nodeBorderColor,
        },
      });
    });
  });

  // Create edges based on match relationships
  // For double elimination, we need to track:
  // 1. Winner advances to next round in winner bracket
  // 2. Loser drops to loser bracket
  // 3. Finals receives winner from winner bracket and loser bracket

  sortedRounds.forEach((round, roundIdx) => {
    const nextRound = sortedRounds[roundIdx + 1];

    if (!nextRound) return;

    round.matches.forEach((match, matchIdx) => {
      // If match has a winner, draw edge to next match
      if (match.winnerId) {
        // Find the next match that this winner feeds into
        // This is a simplified logic - you may need to adjust based on your bracket structure

        if (round.bracketType === 'WINNER') {
          // Winner bracket: advance to next winner bracket round
          const nextMatch = nextRound.matches[Math.floor(matchIdx / 2)];
          if (nextMatch) {
            edges.push({
              id: `${match.id}-winner-${nextMatch.id}`,
              source: match.id,
              target: nextMatch.id,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#10b981', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#10b981',
              },
              label: 'Winner',
              labelStyle: { fill: '#10b981', fontWeight: 600 },
            });
          }
        } else if (round.bracketType === 'LOSER') {
          // Loser bracket: advance to next loser bracket round
          const nextLoserRound = sortedRounds.find(
            (r, idx) => idx > roundIdx && r.bracketType === 'LOSER'
          );
          if (nextLoserRound) {
            const nextMatch = nextLoserRound.matches[Math.floor(matchIdx / 2)];
            if (nextMatch) {
              edges.push({
                id: `${match.id}-loser-${nextMatch.id}`,
                source: match.id,
                target: nextMatch.id,
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#f97316', strokeWidth: 2 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: '#f97316',
                },
              });
            }
          }
        }
      }

      // Also draw edges for losers dropping from winner bracket to loser bracket
      if (round.bracketType === 'WINNER' && !match.winnerId) {
        // Find corresponding loser bracket match
        const loserRounds = sortedRounds.filter(r => r.bracketType === 'LOSER');
        const correspondingLoserRound = loserRounds.find(
          r => Math.abs((r.depth ?? 0) - (round.depth ?? 0)) <= 1
        );
        if (correspondingLoserRound) {
          const loserMatch = correspondingLoserRound.matches[matchIdx % correspondingLoserRound.matches.length];
          if (loserMatch) {
            edges.push({
              id: `${match.id}-drop-${loserMatch.id}`,
              source: match.id,
              target: loserMatch.id,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5 5' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#ef4444',
              },
              label: 'Loser',
              labelStyle: { fill: '#ef4444', fontWeight: 600 },
            });
          }
        }
      }
    });
  });

  return { nodes, edges };
}

export function BracketVisualization({
  rounds,
  onMatchUpdate,
  onError,
  onInfo,
}: BracketVisualizationProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertRoundsToFlow(rounds),
    [rounds]
  );

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges, 'LR'),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when layoutedNodes change
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Find the match from the rounds data
      const match = rounds
        .flatMap(r => r.matches)
        .find(m => m.id === node.id);

      if (match) {
        setSelectedMatch(match);
      }
    },
    [rounds]
  );

  const handleModalClose = () => {
    setSelectedMatch(null);
  };

  const handleMatchUpdate = () => {
    if (onMatchUpdate) {
      onMatchUpdate();
    }
  };

  if (rounds.length === 0) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-400">No bracket data available</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-[800px] bg-gray-900 rounded-lg border border-gray-700">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#374151"
          />
          <Controls
            style={{
              button: {
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                color: '#fff',
              },
            }}
          />
        </ReactFlow>
      </div>

      {/* Scoring Modal */}
      <BracketMatchModal
        match={selectedMatch}
        onClose={handleModalClose}
        onUpdate={handleMatchUpdate}
        onError={onError || (() => {})}
        onInfo={onInfo || (() => {})}
      />
    </>
  );
}
