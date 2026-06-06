import { useTheme } from './ThemeContext';
import { formatDateLocal } from '../utils/helpers';

type Props = {
  value: Date;
  onChange: (d: Date) => void;
};

export default function WebDateInput({ value, onChange }: Props) {
  const { theme, resolvedMode } = useTheme();
  const dateStr = formatDateLocal(value);
  return (
    <input
      type="date"
      value={dateStr}
      onChange={(e) => {
        const parts = e.target.value.split('-');
        const parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(parsed.getTime())) onChange(parsed);
      }}
      style={{
        width: '100%',
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid',
        fontSize: 16,
        marginBottom: 24,
        color: theme.text,
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        colorScheme: resolvedMode,
      }}
    />
  );
}
