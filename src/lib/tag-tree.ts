export type TagTreeNode = {
  segment: string;
  fullPath: string;
  record: Record<string, unknown> | null;
  children: TagTreeNode[];
};

function compareSegments(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortTreeNodes(nodes: TagTreeNode[]): TagTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: sortTreeNodes(node.children),
    }))
    .sort((a, b) => compareSegments(a.segment, b.segment));
}

export function buildTagTree(
  records: Record<string, unknown>[],
  pathField: string,
): TagTreeNode[] {
  const nodeMap = new Map<string, TagTreeNode>();

  function getOrCreateNode(fullPath: string, segment: string): TagTreeNode {
    const existing = nodeMap.get(fullPath);
    if (existing) return existing;

    const node: TagTreeNode = {
      segment,
      fullPath,
      record: null,
      children: [],
    };
    nodeMap.set(fullPath, node);
    return node;
  }

  for (const record of records) {
    const pathValue = record[pathField];
    if (pathValue == null || pathValue === "") continue;

    const segments = String(pathValue).split(".");
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = i === 0 ? segment : `${currentPath}.${segment}`;
      getOrCreateNode(currentPath, segment);
    }

    const leaf = nodeMap.get(String(pathValue));
    if (leaf) {
      leaf.record = record;
    }
  }

  for (const node of nodeMap.values()) {
    const lastDot = node.fullPath.lastIndexOf(".");
    if (lastDot === -1) continue;

    const parentPath = node.fullPath.slice(0, lastDot);
    const parent = nodeMap.get(parentPath);
    if (parent && !parent.children.includes(node)) {
      parent.children.push(node);
    }
  }

  const roots = [...nodeMap.values()].filter(
    (node) => !node.fullPath.includes("."),
  );

  return sortTreeNodes(roots);
}

export function collectTreePaths(nodes: TagTreeNode[]): string[] {
  const paths: string[] = [];
  function walk(nodeList: TagTreeNode[]) {
    for (const node of nodeList) {
      paths.push(node.fullPath);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return paths;
}
