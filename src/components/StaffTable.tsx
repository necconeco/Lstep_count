/**
 * 相談員別実績テーブルコンポーネント
 * TanStack Table使用
 */
import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import { useAggregationStore } from '../store/aggregationStore';
import type { StaffResult } from '../types';
import { useState } from 'react';

const columnHelper = createColumnHelper<StaffResult>();

export const StaffTable = () => {
  const { staffResults } = useAggregationStore();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('staffName', {
        header: '相談員名',
        cell: info => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight="medium">
              {info.getValue()}
            </Typography>
          </Box>
        ),
      }),
      columnHelper.accessor('applications', {
        header: '申込数',
        cell: info => <Chip label={info.getValue()} color="primary" size="small" variant="outlined" />,
      }),
      columnHelper.accessor('implementations', {
        header: '実施数',
        cell: info => <Chip label={info.getValue()} color="success" size="small" variant="outlined" />,
      }),
      columnHelper.accessor('cancellations', {
        header: 'キャンセル数',
        cell: info => <Chip label={info.getValue()} color="error" size="small" variant="outlined" />,
      }),
      columnHelper.accessor('implementationRate', {
        header: '実施率',
        cell: info => (
          <Typography variant="body2" fontWeight="bold" color="primary">
            {info.getValue().toFixed(1)}%
          </Typography>
        ),
      }),
      columnHelper.accessor('firstTimeCount', {
        header: '初回',
        cell: info => (
          <Typography variant="body2" color="text.secondary">
            {info.getValue()}
          </Typography>
        ),
      }),
      columnHelper.accessor('repeatCount', {
        header: '2回目以降',
        cell: info => (
          <Typography variant="body2" color="text.secondary">
            {info.getValue()}
          </Typography>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: staffResults,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (staffResults.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon />
        相談員別実績
      </Typography>

      <Card elevation={2}>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableCell
                        key={header.id}
                        sx={{
                          fontWeight: 'bold',
                          bgcolor: 'grey.100',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' 🔼',
                            desc: ' 🔽',
                          }[header.column.getIsSorted() as string] ?? null}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
