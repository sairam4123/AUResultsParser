"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
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
import { type DataState } from "./types";

type SummaryCard = {
  label: string;
  value: number | null;
  suffix?: string;
};

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
  setSemester: Dispatch<SetStateAction<number>>;
  batch: string;
  setBatch: Dispatch<SetStateAction<string>>;
  topK: number;
  setTopK: Dispatch<SetStateAction<number>>;
  canQuery: boolean;
  summaryCards: SummaryCard[];
  markPanelsLoading: () => void;
};

const initialDataState = <T,>(loading = false): DataState<T> => ({
  loading,
  error: null,
  data: null,
});

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export const ExplorerProvider = ({ children }: { children: ReactNode }) => {
  const [meta, setMeta] = useState<DataState<MetaResponse>>(initialDataState(true));
  const [summary, setSummary] = useState<DataState<SummaryResponse>>(
    initialDataState(true),
  );
  const [ranks, setRanks] = useState<DataState<RankListResponse>>(initialDataState(true));
  const [arrears, setArrears] = useState<DataState<ArrearsResponse>>(
    initialDataState(true),
  );
  const [subjectSummary, setSubjectSummary] = useState<
    DataState<SubjectSummaryResponse>
  >(initialDataState(true));
  const [studentsDirectory, setStudentsDirectory] = useState<
    DataState<StudentDirectoryItem[]>
  >(initialDataState());

  const [department, setDepartment] = useState<string>("");
  const [semester, setSemester] = useState<number>(0);
  const [batch, setBatch] = useState<string>("");
  const [topK, setTopK] = useState<number>(10);

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

        if (payload.semesters.length > 0) {
          const latestSemester = payload.semesters[payload.semesters.length - 1];
          setSemester(latestSemester);
        }

        if (payload.batches.length > 0) {
          setBatch(payload.batches[0]);
        }
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

  const canQuery = useMemo(
    () => department.length > 0 && semester > 0,
    [department, semester],
  );

  useEffect(() => {
    if (!canQuery) {
      return;
    }

    void Promise.allSettled([
      api.getSummary(semester, department, batch || null),
      api.getRankList(semester, department, batch || null, topK),
      api.getArrears(semester, department, batch || null),
      api.getArrears(semester, department, batch || null, { bucket: "1" }),
      api.getArrears(semester, department, batch || null, { bucket: "2" }),
      api.getArrears(semester, department, batch || null, { bucket: "3+" }),
      api.getSubjectSummary(semester, department, batch || null),
    ]).then((results) => {
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
          arrears1Result.status === "fulfilled" ? arrears1Result.value.students : null,
          arrears2Result.status === "fulfilled" ? arrears2Result.value.students : null,
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
  }, [batch, canQuery, department, semester, topK]);

  useEffect(() => {
    if (!canQuery) {
      return;
    }

    api
      .getStudentsDirectory(semester, department, batch || null, { limit: 3000 })
      .then((payload) => {
        setStudentsDirectory({ loading: false, error: null, data: payload.items });
      })
      .catch((error: Error) => {
        setStudentsDirectory({ loading: false, error: error.message, data: null });
      });
  }, [batch, canQuery, department, semester]);

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
    setSemester,
    batch,
    setBatch,
    topK,
    setTopK,
    canQuery,
    summaryCards,
    markPanelsLoading,
  };

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
};

export const useExplorer = () => {
  const context = useContext(ExplorerContext);

  if (!context) {
    throw new Error("useExplorer must be used within ExplorerProvider");
  }

  return context;
};
