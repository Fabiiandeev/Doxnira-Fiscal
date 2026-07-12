"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type CrudService<TRecord, TCreate, TUpdate> = {
  list: () => Promise<TRecord[]>;
  create: (data: TCreate) => Promise<TRecord>;
  update: (id: string, data: TUpdate) => Promise<TRecord>;
  remove: (id: string) => Promise<unknown>;
};

export function useCrud<TRecord, TCreate, TUpdate>({
  queryKey,
  service,
}: {
  queryKey: readonly unknown[];
  service: CrudService<TRecord, TCreate, TUpdate>;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: service.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: service.create,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TUpdate }) => service.update(id, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: service.remove,
    onSuccess: invalidate,
  });

  return {
    query,
    create,
    update,
    remove,
  };
}
