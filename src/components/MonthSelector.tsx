/**
 * 月選択ドロップダウンコンポーネント
 * CSVデータから抽出された月を選択
 */
import { Box, FormControl, InputLabel, Select, MenuItem, Typography, Chip } from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { useCsvStore } from '../store/csvStore';

export const MonthSelector = () => {
  const { selectedMonth, availableMonths, setSelectedMonth } = useCsvStore();

  // データがない場合は表示しない
  if (availableMonths.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            対象月を選択
          </Typography>
        </Box>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="month-selector-label">対象月</InputLabel>
          <Select
            labelId="month-selector-label"
            id="month-selector"
            value={selectedMonth || ''}
            label="対象月"
            onChange={e => setSelectedMonth(e.target.value || null)}
          >
            {availableMonths.map(month => (
              <MenuItem key={month} value={month}>
                {month}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedMonth && (
          <Chip label={`${selectedMonth}のデータを表示中`} color="primary" variant="outlined" sx={{ ml: 1 }} />
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        利用可能な月: {availableMonths.length}ヶ月
      </Typography>
    </Box>
  );
};
