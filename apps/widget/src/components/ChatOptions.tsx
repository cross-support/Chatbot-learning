interface ScenarioOption {
  nodeId: number;
  label: string;
}

interface ChatOptionsProps {
  options: ScenarioOption[];
  onSelect: (nodeId: number) => void;
}

export function ChatOptions({ options, onSelect }: ChatOptionsProps) {
  return (
    <div class="options-container">
      {options.map((option) => (
        <button
          key={option.nodeId}
          class="option-button"
          onClick={() => onSelect(option.nodeId)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
