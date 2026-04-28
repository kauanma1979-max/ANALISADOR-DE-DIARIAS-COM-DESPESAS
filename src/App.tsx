/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw, 
  PieChart, 
  BarChart3, 
  Table as TableIcon, 
  Plus,
  Coins,
  Search,
  Calendar,
  Layers,
  Save,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { DiariaRecord, Expense, TabType, MESES_NUMERO, MONTH_ORDER } from './types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function App() {
  const [allData, setAllData] = useState<DiariaRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [isLoading, setIsLoading] = useState(false);
  const [mesFilter, setMesFilter] = useState('all');
  const [anoFilter, setAnoFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Expense Form State
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [expenseType, setExpenseType] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<Expense[] | null>(null);
  const [backupInfo, setBackupInfo] = useState({ date: '', count: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // Load expenses on mount
  useEffect(() => {
    const saved = localStorage.getItem('diarias_expenses');
    if (saved) {
      try {
        setExpenses(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading expenses', e);
      }
    }
  }, []);

  // Save expenses when they change
  useEffect(() => {
    localStorage.setItem('diarias_expenses', JSON.stringify(expenses));
  }, [expenses]);

  const parseDateTime = (dateStr: any) => {
    if (!dateStr) return { data: '', hora: '' };
    const parts = dateStr.toString().split(' ');
    const data = parts[0] || '';
    const hora = parts[1] || '';
    return { data, hora };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedData = (jsonData as any[]).map((row, idx) => {
          const so = parseDateTime(row['Saída Origem'] || '');
          const co = parseDateTime(row['Chegada Origem'] || '');
          const sd = parseDateTime(row['Saída Destino'] || '');
          const cd = parseDateTime(row['Chegada Destino'] || '');
          
          let mes = '';
          let ano = 0;

          const primarySaida = so.data ? so : (sd.data ? sd : { data: '', hora: '' });

          if (primarySaida.data) {
            const dataParts = primarySaida.data.split('/');
            if (dataParts.length === 3) {
              const mesNum = parseInt(dataParts[1]);
              const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              mes = meses[mesNum] || '';
              ano = parseInt(dataParts[2]);
            }
          }

          if (!ano) {
            ano = parseInt(row['Ano'] || row['Ano.1'] || 0) || 0;
          }

          // Local normalize status "ConUG" or similar to "Concluído"
          let status = row['Status'] || 'Concluído';
          if (status.toString().toUpperCase().startsWith('CON')) {
            status = 'Concluído';
          }

          return {
            id: row['Id'] || (idx + 1),
            cpf: row['CPF'] || '',
            nome: row['Nome Credor'] || '',
            cargo: row['Cargo'] || '',
            mes,
            ano,
            origem: row['Origem'] || '',
            destino: row['Destino'] || '',
            saidaOrigem: so.data ? `${so.data} ${so.hora}` : '',
            chegadaOrigem: co.data ? `${co.data} ${co.hora}` : '',
            saidaDestino: sd.data ? `${sd.data} ${sd.hora}` : '',
            chegadaDestino: cd.data ? `${cd.data} ${cd.hora}` : '',
            motivo: row['Motivo'] || '',
            status: status,
            totalPago: parseFloat(row['Total Pago'] || 0) || 0
          };
        }).filter(r => r.ano > 0 && r.totalPago >= 0);

        setAllData(processedData);
        
        // Auto set filter to current date if exists
        const hoje = new Date();
        const curMes = MONTH_ORDER[hoje.getMonth()];
        const curAno = hoje.getFullYear();
        if (processedData.some(d => d.mes === curMes && d.ano === curAno)) {
          setMesFilter(curMes);
          setAnoFilter(curAno.toString());
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error processing file', error);
        alert('Erro ao processar arquivo Excel.');
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredData = useMemo(() => {
    return allData.filter(r => {
      const mesMatch = mesFilter === 'all' || r.mes === mesFilter;
      const anoMatch = anoFilter === 'all' || r.ano === parseInt(anoFilter);
      const searchMatch = !searchFilter || 
        r.destino.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.origem.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.motivo.toLowerCase().includes(searchFilter.toLowerCase());
      return mesMatch && anoMatch && searchMatch;
    });
  }, [allData, mesFilter, anoFilter, searchFilter]);

  const uniqueMeses = useMemo(() => {
    const mesesDiarias = [...new Set(allData.map(r => r.mes).filter(m => m))];
    const mesesDespesas = [...new Set(expenses.map(exp => {
      const expDate = new Date(exp.date);
      return MONTH_ORDER[expDate.getMonth()];
    }).filter(m => m))];
    const todos = [...new Set([...mesesDiarias, ...mesesDespesas])];
    return todos.sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
  }, [allData, expenses]);

  const uniqueAnos = useMemo(() => {
    const anosData = [...new Set(allData.map(r => r.ano).filter(a => a))];
    const anosDespesas = [...new Set(expenses.map(exp => new Date(exp.date).getFullYear()).filter(a => a))];
    const todos = [...new Set([...anosData, ...anosDespesas])];
    return todos.sort((a, b) => a - b);
  }, [allData, expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = new Date(exp.date);
      const expMes = MONTH_ORDER[expDate.getMonth()];
      const expAno = expDate.getFullYear();
      
      const mesMatch = mesFilter === 'all' || expMes === mesFilter;
      const anoMatch = anoFilter === 'all' || expAno === parseInt(anoFilter);
      return mesMatch && anoMatch;
    });
  }, [expenses, mesFilter, anoFilter]);

  const totalPago = useMemo(() => filteredData.reduce((sum, r) => sum + r.totalPago, 0), [filteredData]);
  const totalDespesas = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + exp.value, 0), [filteredExpenses]);
  const valorLiquido = totalPago - totalDespesas;

  const addExpense = () => {
    if (!expenseDate || !expenseValue || !expenseType) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    const newExpense: Expense = {
      id: Date.now(),
      date: expenseDate,
      value: parseFloat(expenseValue),
      type: expenseType,
      description: expenseDescription
    };
    setExpenses([...expenses, newExpense]);
    setExpenseDate('');
    setExpenseValue('');
    setExpenseType('');
    setExpenseDescription('');
  };

  const deleteExpense = (id: number) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const downloadBackup = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      expenses: expenses
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_despesas_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result as string);
        if (backup.expenses && Array.isArray(backup.expenses)) {
          setPendingRestoreData(backup.expenses);
          setBackupInfo({
            date: new Date(backup.timestamp).toLocaleDateString('pt-BR'),
            count: backup.expenses.length
          });
          setShowConfirmModal(true);
        }
      } catch (error) {
        alert('Arquivo de backup inválido');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const confirmRestore = () => {
    if (pendingRestoreData) {
      setExpenses(pendingRestoreData);
      setShowConfirmModal(false);
      setPendingRestoreData(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const resetApp = () => {
    setAllData([]);
    setMesFilter('all');
    setAnoFilter('all');
    setSearchFilter('');
    setActiveTab('dados');
  };

  // Chart Data Preparation
  const chartMonthlyData = useMemo(() => {
    const grouped: Record<string, any> = {};
    allData.forEach(r => {
      const key = `${r.ano}-${r.mes}`;
      if (!grouped[key]) grouped[key] = { solicitacoes: 0, pago: 0 };
      grouped[key].solicitacoes++;
      grouped[key].pago += r.totalPago;
    });

    const entries = Object.entries(grouped).map(([key, val]) => {
      const [ano, mes] = key.split('-');
      const despesas = expenses.filter(exp => {
        const d = new Date(exp.date);
        return MONTH_ORDER[d.getMonth()] === mes && d.getFullYear() === parseInt(ano);
      }).reduce((sum, e) => sum + e.value, 0);

      return {
        key,
        mes,
        ano: parseInt(ano),
        pago: val.pago,
        solicitacoes: val.solicitacoes,
        despesas,
        liquido: val.pago - despesas
      };
    }).sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return MONTH_ORDER.indexOf(a.mes) - MONTH_ORDER.indexOf(b.mes);
    });

    return entries;
  }, [allData, expenses]);

  const chartStatusData = useMemo(() => {
    const grouped: Record<string, number> = {};
    allData.forEach(r => {
      grouped[r.status] = (grouped[r.status] || 0) + 1;
    });
    return grouped;
  }, [allData]);

  if (allData.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-3xl shadow-xl max-w-2xl w-full text-center border border-slate-100"
        >
          <div className="flex justify-center mb-8">
            <div className="p-5 bg-blue-50 rounded-2xl">
              <FileSpreadsheet className="w-16 h-16 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Analisador de Diárias
          </h1>
          <p className="text-slate-500 mb-10 text-lg">
            Carregue sua planilha Excel para análise completa de diárias e controle de despesas.
          </p>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer border-2 border-dashed border-blue-200 rounded-2xl p-10 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
          >
            <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
            <p className="text-blue-600 font-semibold text-lg">Clique para selecionar</p>
            <p className="text-slate-400 mt-2">Formatos suportados: .xlsx, .xls</p>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden" 
              accept=".xlsx,.xls"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Processando dados...</p>
        </div>
      </div>
    );
  }

  const headerInfo = allData[0] || {};

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileSpreadsheet className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Análise de Diárias</h2>
              <p className="text-sm text-slate-500 font-medium">{headerInfo.nome} • {headerInfo.cargo}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={downloadBackup}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors font-semibold text-sm border border-emerald-100"
            >
              <Save className="w-4 h-4" />
              Backup
            </button>
            <button 
              onClick={() => restoreInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-semibold text-sm border border-amber-100"
            >
              <FolderOpen className="w-4 h-4" />
              Restaurar
              <input type="file" ref={restoreInputRef} onChange={handleRestoreFile} className="hidden" accept=".json" />
            </button>
            <button 
              onClick={resetApp}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-semibold text-sm"
            >
              Novo Arquivo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        {/* Filters */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Mês
            </label>
            <select 
              value={mesFilter}
              onChange={(e) => setMesFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="all">Todos os meses</option>
              {uniqueMeses.map(m => (
                <option key={m} value={m}>{MESES_NUMERO[m] || m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Ano
            </label>
            <select 
              value={anoFilter}
              onChange={(e) => setAnoFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            >
              <option value="all">Todos os anos</option>
              {uniqueAnos.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Search className="w-3 h-3" /> Buscar
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Origem, destino, motivo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total de Diárias', value: filteredData.length, color: 'from-blue-600 to-blue-700', icon: TableIcon },
            { label: 'Total Recebido', value: formatCurrency(totalPago), color: 'from-emerald-500 to-emerald-600', icon: Coins },
            { label: 'Total Despesas', value: formatCurrency(totalDespesas), color: 'from-rose-500 to-rose-600', icon: Trash2 },
            { label: 'Valor Líquido', value: formatCurrency(valorLiquido), color: 'from-violet-600 to-violet-700', icon: BarChart3 },
          ].map((kpi, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              className={cn("p-6 rounded-3xl shadow-sm text-white flex flex-col justify-between h-32 bg-gradient-to-br", kpi.color)}
            >
              <div className="flex justify-between items-start">
                <p className="text-base font-bold text-white tracking-wide">{kpi.label}</p>
                <kpi.icon className="w-6 h-6 text-white/40" />
              </div>
              <p className="text-3xl font-black tracking-tight">{kpi.value}</p>
            </motion.div>
          ))}
        </section>

        {/* Tabs */}
        <section className="border-b border-slate-200 mb-8 overflow-x-auto flex flex-nowrap">
          {[
            { id: 'dados', label: 'Dados', icon: TableIcon },
            { id: 'despesas', label: 'Despesas', icon: Coins },
            { id: 'analise', label: 'Análise Mensal', icon: BarChart3 },
            { id: 'anual', label: 'Análise Anual', icon: Layers },
            { id: 'status', label: 'Status', icon: PieChart },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "px-6 py-4 flex items-center gap-2 font-semibold text-sm transition-all relative",
                activeTab === tab.id ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </section>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dados' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="w-full overflow-x-hidden">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase w-[15%]">Destino</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase w-[13%]">Saída/Chegada Or.</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase w-[13%]">Saída/Chegada Dest.</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase w-[35%]">Motivo</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase w-[12%]">Status</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase text-right w-[12%]">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-4 text-xs text-slate-700 font-semibold align-top">{r.destino}</td>
                          <td className="px-3 py-4 text-[11px] text-slate-500 leading-tight align-top">
                            <div className="font-bold text-slate-600">S: {r.saidaOrigem}</div>
                            <div className="mt-1">C: {r.chegadaOrigem}</div>
                          </td>
                          <td className="px-3 py-4 text-[11px] text-slate-500 leading-tight align-top">
                            <div className="font-bold text-slate-600">S: {r.saidaDestino}</div>
                            <div className="mt-1">C: {r.chegadaDestino}</div>
                          </td>
                          <td className="px-3 py-4 text-xs text-slate-600 leading-relaxed align-top">
                            <div className="line-clamp-6" title={r.motivo}>
                              {r.motivo}
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter block text-center",
                              r.status === 'Concluído' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-600 border border-slate-200"
                            )}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-sm font-bold text-slate-900 text-right align-top">
                            <div className="whitespace-nowrap">{formatCurrency(r.totalPago)}</div>
                          </td>
                        </tr>
                      ))}
                      {filteredData.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-20 text-center text-slate-400">
                            Nenhum registro encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'despesas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                       <Plus className="w-5 h-5 text-blue-500" /> Registrar Despesa
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Data</label>
                        <input 
                          type="date" 
                          value={expenseDate}
                          onChange={e => setExpenseDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor</label>
                        <input 
                          type="number" 
                          placeholder="0.00"
                          value={expenseValue}
                          onChange={e => setExpenseValue(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo</label>
                        <select 
                           value={expenseType}
                           onChange={e => setExpenseType(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                        >
                          <option value="">Selecione...</option>
                          <option value="Hospedagem - Hotel">Hospedagem - Hotel</option>
                          <option value="Hospedagem - Airbnb">Hospedagem - Airbnb</option>
                          <option value="Alimentação">Alimentação</option>
                          <option value="Transporte">Transporte</option>
                          <option value="Lazer">Lazer</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Descrição</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Almoço em SP"
                          value={expenseDescription}
                          onChange={e => setExpenseDescription(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                        />
                      </div>
                      <button 
                        onClick={addExpense}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mt-4"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-widest">Resumo por Tipo</h3>
                    <div className="space-y-3">
                      {Object.entries(
                        filteredExpenses.reduce((acc: any, curr) => {
                          acc[curr.type] = (acc[curr.type] || 0) + curr.value;
                          return acc;
                        }, {})
                      ).map(([type, total]: any) => (
                        <div key={type} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-sm text-slate-600 font-medium">{type}</span>
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  {expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((exp) => (
                    <motion.div 
                      layout
                      key={exp.id} 
                      className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center hover:shadow-md transition-shadow group"
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          <Coins className="text-blue-600 w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{exp.type}</p>
                          <p className="text-xs text-slate-400">{new Date(exp.date).toLocaleDateString('pt-BR')} • {exp.description || 'Sem descrição'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-lg font-bold text-rose-600">{formatCurrency(exp.value)}</p>
                        <button 
                          onClick={() => deleteExpense(exp.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {expenses.length === 0 && (
                    <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center text-slate-400">
                      Nenhuma despesa registrada.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analise' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">
                      Diárias vs Despesas ({mesFilter === 'all' ? 'Geral' : MESES_NUMERO[mesFilter]} {anoFilter === 'all' ? '' : anoFilter})
                    </h3>
                    {(() => {
                      const targetMes = mesFilter;
                      const targetAno = anoFilter !== 'all' ? parseInt(anoFilter) : null;
                      
                      const filteredDiarios = allData.filter(r => {
                        const mMatch = targetMes === 'all' || r.mes === targetMes;
                        const aMatch = targetAno === null || r.ano === targetAno;
                        return mMatch && aMatch;
                      });

                      const totalDiarias = filteredDiarios.reduce((sum, r) => sum + r.totalPago, 0);
                      
                      const despesasPorTipo: Record<string, number> = {};
                      expenses.filter(exp => {
                        const d = new Date(exp.date);
                        const expMes = MONTH_ORDER[d.getMonth()];
                        const expAno = d.getFullYear();
                        const mMatch = targetMes === 'all' || expMes === targetMes;
                        const aMatch = targetAno === null || expAno === targetAno;
                        return mMatch && aMatch;
                      }).forEach(exp => {
                        despesasPorTipo[exp.type] = (despesasPorTipo[exp.type] || 0) + exp.value;
                      });

                      const labels = ['Diárias Recebidas', ...Object.keys(despesasPorTipo)];
                      const dataValues = [totalDiarias, ...Object.values(despesasPorTipo)];
                      const colors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'];

                      return (
                        <Bar 
                          options={{ 
                            responsive: true, 
                            plugins: { 
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: (context) => formatCurrency(context.raw as number)
                                }
                              }
                            } 
                          }}
                          data={{
                            labels: labels,
                            datasets: [
                              { 
                                data: dataValues, 
                                backgroundColor: colors.slice(0, dataValues.length),
                                borderRadius: 8
                              }
                            ]
                          }} 
                        />
                      );
                    })()}
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Evolução Mensal (Receita vs Despesa)</h3>
                    <Line 
                      options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                      data={{
                        labels: chartMonthlyData.map(m => `${m.mes} ${m.ano}`),
                        datasets: [
                          { label: 'Recebido', data: chartMonthlyData.map(m => m.pago), borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.3 },
                          { label: 'Despesas', data: chartMonthlyData.map(m => m.despesas), borderColor: '#e11d48', backgroundColor: '#e11d48', tension: 0.3 }
                        ]
                      }} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Volume de Solicitações (Últimos 12 Meses)</h3>
                    {(() => {
                      const last12Months = chartMonthlyData.slice(-12);
                      return (
                        <Bar 
                          options={{ responsive: true, plugins: { legend: { display: false } } }}
                          data={{
                            labels: last12Months.map(m => `${m.mes} ${m.ano}`),
                            datasets: [
                              { data: last12Months.map(m => m.solicitacoes), backgroundColor: '#3b82f6', borderRadius: 8 }
                            ]
                          }} 
                        />
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Mês/Ano</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Protocolos</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Recebido</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Despesas</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Líquido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {chartMonthlyData.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-800 uppercase tracking-wide">{MESES_NUMERO[m.mes]} {m.ano}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 text-center font-medium">{m.solicitacoes}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 text-right">{formatCurrency(m.pago)}</td>
                            <td className="px-6 py-4 text-sm text-rose-600 text-right">{formatCurrency(m.despesas)}</td>
                            <td className={cn("px-6 py-4 text-sm font-bold text-right", m.liquido >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {formatCurrency(m.liquido)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'anual' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 text-center">Histórico Anual de Receitas</h3>
                    <Bar 
                      style={{ maxHeight: '350px' }}
                      options={{ 
                        responsive: true, 
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { display: false } } }
                      }}
                      data={{
                        labels: [...new Set(chartMonthlyData.map(m => m.ano))].sort((a,b) => a - b),
                        datasets: [{ 
                           data: [...new Set(chartMonthlyData.map(m => m.ano))].sort((a,b) => a-b).map(ano => 
                             chartMonthlyData.filter(m => m.ano === ano).reduce((s, c) => s + c.pago, 0)
                           ),
                           backgroundColor: '#10b981', borderRadius: 12
                        }]
                      }} 
                    />
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 text-center">Histórico Anual de Gastos</h3>
                    <Bar 
                      style={{ maxHeight: '350px' }}
                      options={{ 
                        responsive: true, 
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { display: false } } }
                      }}
                      data={{
                        labels: [...new Set(chartMonthlyData.map(m => m.ano))].sort((a,b) => a - b),
                        datasets: [{ 
                           data: [...new Set(chartMonthlyData.map(m => m.ano))].sort((a,b) => a-b).map(ano => 
                             chartMonthlyData.filter(m => m.ano === ano).reduce((s, c) => s + c.despesas, 0)
                           ),
                           backgroundColor: '#f43f5e', borderRadius: 12
                        }]
                      }} 
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'status' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                 <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                   <h3 className="text-lg font-bold text-slate-800 mb-10">Status das Solicitações</h3>
                   <div className="w-full max-w-sm">
                    <Doughnut 
                      data={{
                        labels: Object.keys(chartStatusData),
                        datasets: [{
                          data: Object.values(chartStatusData),
                          backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#7c3aed', '#f43f5e']
                        }]
                      }}
                      options={{ cutout: '70%', plugins: { legend: { position: 'bottom' } } }}
                    />
                   </div>
                 </div>

                 <div className="space-y-4">
                    {Object.entries(chartStatusData).map(([status, count]) => (
                      <div key={status} className="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">{status}</p>
                          <p className="text-3xl font-black text-slate-800">{count}</p>
                        </div>
                        <div className={cn(
                          "w-3 h-12 rounded-full",
                          status === 'Concluído' ? "bg-emerald-500" : "bg-blue-500"
                        )} />
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Restore Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">Restaurar Backup?</h3>
            <p className="text-slate-500 mb-6">
              O arquivo contém <span className="font-bold text-slate-800">{backupInfo.count}</span> despesas criadas em <span className="font-bold text-slate-800">{backupInfo.date}</span>.
              <br /><br />
              <span className="text-rose-600 font-semibold italic">Isso substituirá suas despesas atuais.</span>
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRestore}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
              >
                Sim, restaurar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
