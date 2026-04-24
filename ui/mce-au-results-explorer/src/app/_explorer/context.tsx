"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  api,
  type ArrearsResponse,
  type MetaResponse,
  type RankListResponse,
  type StudentDirectoryItem,
  type SubjectSummaryResponse,
  type SummaryResponse,
} from "../../lib/api";
import { mergeArrearStudents } from "./utils";
import { type DataState, type SummaryCard, type KpiPayload } from "./types";

type ExplorerContextValue = {
  meta: DataState<MetaResponse>;
  summary: DataState<SummaryResponse>;
  ranks: DataState<RankListResponse>;
  arrears: DataState<ArrearsResponse>;
  subjectSummary: DataState<SubjectSummaryResponse>;
  studentsDirectory: DataState<StudentDirectoryItem[]>;
  department: string;
  setDepartment: Dispatch<SetStateAction<string>>;
  semester: number;
  selectedSemesters: number[];
  setSelectedSemesters: Dispatch<SetStateAction<number[]>>;
  batch: string;
  setBatch: Dispatch<SetStateAction<string>>;
  topK: number;
  setTopK: Dispatch<SetStateAction<number>>;
  canQuery: boolean;
  summaryCards: SummaryCard[];
  pageKpi: KpiPayload | null;
  setPageKpi: Dispatch<SetStateAction<KpiPayload | null>>;
  markPanelsLoading: () => void;
};

const initialDataState = <T,>(loading = false): DataState<T> => ({
  loading,
  error: null,
  data: null,
});

const getSemestersForBatch = (
  metaData: MetaResponse | null | undefined,
  batchValue: string,
): number[] => {
  if (!metaData) {
    return [];
  }

  const normalizedBatch = batchValue.trim();
  if (!normalizedBatch) {
    return metaData.semesters;
  }

  const mapped = metaData.semesters_by_batch?.[normalizedBatch];
  if (!mapped || mapped.length === 0) {
    return metaData.semesters;
  }

  return mapped;
};

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export const ExplorerProvider = ({ children }: { children: ReactNode }) => {
  const [meta, setMeta] = useState<DataState<MetaResponse>>(
    initialDataState(true),
  );
  const [summary, setSummary] = useState<DataState<SummaryResponse>>(
    initialDataState(true),
  );
  const [ranks, setRanks] = useState<DataState<RankListResponse>>(
    initialDataState(true),
  );
  const [arrears, setArrears] = useState<DataState<ArrearsResponse>>(
    initialDataState(true),
  );
  const [subjectSummary, setSubjectSummary] = useState<
    DataState<SubjectSummaryResponse>
  >(initialDataState(true));
  const [studentsDirectory, setStudentsDirectory] =
    useState<DataState<StudentDirectoryItem[]>>(initialDataState());

  const [department, setDepartment] = useState<string>("");
  const [semester, setSemester] = useState<number>(0);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]);
  const [batch, setBatch] = useState<string>("");
  const [topK, setTopK] = useState<number>(10);
  const [pageKpi, setPageKpi] = useState<KpiPayload | null>(null);
  const queryRequestIdRef = useRef(0);
  const studentsRequestIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    api
      .getMeta()
      .then((payload) => {
        if (!mounted) {
          return;
        }

        setMeta({ loading: false, error: null, data: payload });

        if (payload.departments.length > 0) {
          setDepartment(payload.departments[0].name);
        }

        const defaultBatch =
          payload.batches.length > 0 ? payload.batches[0] : "";
        setBatch(defaultBatch);

        const sortedSemesters = [
          ...getSemestersForBatch(payload, defaultBatch),
        ].sort((a, b) => b - a);
        setSelectedSemesters(sortedSemesters);
        setSemester(sortedSemesters[0] ?? 0);
      })
      .catch((error: Error) => {
        if (!mounted) {
          return;
        }
        setMeta({ loading: false, error: error.message, data: null });
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!meta.data) {
      return;
    }

    const availableSemesters = [...getSemestersForBatch(meta.data, batch)].sort(
      (a, b) => b - a,
    );

    const allowed = new Set(availableSemesters);
    const filtered = selectedSemesters
      .filter((value) => allowed.has(value))
      .sort((a, b) => b - a);
    const nextSemesters = filtered.length > 0 ? filtered : availableSemesters;

    const changed =
      nextSemesters.length !== selectedSemesters.length ||
      nextSemesters.some((value, index) => value !== selectedSemesters[index]);

    if (changed) {
      setSelectedSemesters(nextSemesters);
    }
  }, [batch, meta.data, selectedSemesters]);

  useEffect(() => {
    if (selectedSemesters.length === 0) {
      setSemester(0);
      return;
    }

    if (semester !== selectedSemesters[0]) {
      setSemester(selectedSemesters[0]);
    }
  }, [selectedSemesters, semester]);

  const canQuery = useMemo(
    () => department.length > 0 && selectedSemesters.length > 0,
    [department, selectedSemesters],
  );

  useEffect(() => {
    if (!canQuery) {
      return;
    }

    const activeSemester = selectedSemesters[0] ?? 0;
    if (!activeSemester || semester !== activeSemester) {
      return;
    }

    const requestId = queryRequestIdRef.current + 1;
    queryRequestIdRef.current = requestId;

    void Promise.allSettled([
      api.getSummary(activeSemester, department, batch || null),
      api.getRankList(activeSemester, department, batch || null, topK),
      api.getArrears(activeSemester, department, batch || null),
      api.getArrears(activeSemester, department, batch || null, {
        bucket: "1",
      }),
      api.getArrears(activeSemester, department, batch || null, {
        bucket: "2",
      }),
      api.getArrears(activeSemester, department, batch || null, {
        bucket: "3+",
      }),
      api.getSubjectSummary(activeSemester, department, batch || null),
    ]).then((results) => {
      if (requestId !== queryRequestIdRef.current) {
        return;
      }

      const [
        summaryResult,
        rankResult,
        arrearsResult,
        arrears1Result,
        arrears2Result,
        arrears3PlusResult,
        subjectResult,
      ] = results;

      if (summaryResult.status === "fulfilled") {
        setSummary({ loading: false, error: null, data: summaryResult.value });
      } else {
        setSummary({
          loading: false,
          error: summaryResult.reason?.message || "Failed",
          data: null,
        });
      }

      if (rankResult.status === "fulfilled") {
        setRanks({ loading: false, error: null, data: rankResult.value });
      } else {
        setRanks({
          loading: false,
          error: rankResult.reason?.message || "Failed",
          data: null,
        });
      }

      if (arrearsResult.status === "fulfilled") {
        const mergedStudents = mergeArrearStudents([
          arrears1Result.status === "fulfilled"
            ? arrears1Result.value.students
            : null,
          arrears2Result.status === "fulfilled"
            ? arrears2Result.value.students
            : null,
          arrears3PlusResult.status === "fulfilled"
            ? arrears3PlusResult.value.students
            : null,
        ]);

        setArrears({
          loading: false,
          error: null,
          data: {
            ...arrearsResult.value,
            students: mergedStudents,
          },
        });
      } else {
        setArrears({
          loading: false,
          error: arrearsResult.reason?.message || "Failed",
          data: null,
        });
      }

      if (subjectResult.status === "fulfilled") {
        setSubjectSummary({
          loading: false,
          error: null,
          data: subjectResult.value,
        });
      } else {
        setSubjectSummary({
          loading: false,
          error: subjectResult.reason?.message || "Failed",
          data: null,
        });
      }
    });
  }, [batch, canQuery, department, selectedSemesters, semester, topK]);

  useEffect(() => {
    if (!canQuery) {
      return;
    }

    const activeSemester = selectedSemesters[0] ?? 0;
    if (!activeSemester || semester !== activeSemester) {
      return;
    }

    const requestId = studentsRequestIdRef.current + 1;
    studentsRequestIdRef.current = requestId;

    api
      .getStudentsDirectory(activeSemester, department, batch || null, {
        limit: 3000,
      })
      .then((payload) => {
        if (requestId !== studentsRequestIdRef.current) {
          return;
        }

        setStudentsDirectory({
          loading: false,
          error: null,
          data: payload.items,
        });
      })
      .catch((error: Error) => {
        if (requestId !== studentsRequestIdRef.current) {
          return;
        }

        setStudentsDirectory({
          loading: false,
          error: error.message,
          data: null,
        });
      });
  }, [batch, canQuery, department, selectedSemesters, semester]);

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      { label: "Appeared", value: summary.data?.summary.appeared ?? null },
      { label: "Passed", value: summary.data?.summary.passed ?? null },
      { label: "Failed", value: summary.data?.summary.failed ?? null },
      {
        label: "Pass %",
        value: summary.data?.summary.pass_percentage ?? null,
        suffix: "%",
      },
    ],
    [summary.data],
  );

  const markPanelsLoading = () => {
    setSummary((prev) => ({ ...prev, loading: true, error: null }));
    setRanks((prev) => ({ ...prev, loading: true, error: null }));
    setArrears((prev) => ({ ...prev, loading: true, error: null }));
    setSubjectSummary((prev) => ({ ...prev, loading: true, error: null }));
  };

  const value: ExplorerContextValue = {
    meta,
    summary,
    ranks,
    arrears,
    subjectSummary,
    studentsDirectory,
    department,
    setDepartment,
    semester,
    selectedSemesters,
    setSelectedSemesters,
    batch,
    setBatch,
    topK,
    setTopK,
    canQuery,
    summaryCards,
    pageKpi,
    setPageKpi,
    markPanelsLoading,
  };

  return (
    <ExplorerContext.Provider value={value}>
      {children}
    </ExplorerContext.Provider>
  );
};

export const useExplorer = () => {
  const context = useContext(ExplorerContext);

  if (!context) {
    throw new Error("useExplorer must be used within ExplorerProvider");
  }

  return context;
};
