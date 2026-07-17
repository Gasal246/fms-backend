import { describe, it, expect, vi, beforeEach } from "vitest";
import { CounterUseCase } from "./counter.usecase.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { CounterRepository } from "../../domain/repositories/counter.repository.interface.js";

describe("CounterUseCase", () => {
  let counterRepositoryMock: CounterRepository;
  let counterUseCase: CounterUseCase;

  beforeEach(() => {
    counterRepositoryMock = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as CounterRepository;

    counterUseCase = new CounterUseCase(counterRepositoryMock);
  });

  describe("createCounter", () => {
    it("should successfully create a counter", async () => {
      const input = {
        client_id: "60d5ec49f1b29e2f64d06a01",
        camp_id: "60d5ec49f1b29e2f64d06a02",
        zone_id: "60d5ec49f1b29e2f64d06a03",
        counter_name: "Counter Main",
        created_by: "60d5ec49f1b29e2f64d06a04",
      };

      const expectedResponse = {
        id: "60d5ec49f1b29e2f64d06a05",
        ...input,
        counter_no: "COUNTER-0001",
        status: "Active",
      };

      vi.spyOn(counterRepositoryMock, "create").mockResolvedValue(expectedResponse);

      const result = await counterUseCase.createCounter(input);

      expect(counterRepositoryMock.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(expectedResponse);
    });

    it("should propagate AppError from repository", async () => {
      const input = {
        client_id: "60d5ec49f1b29e2f64d06a01",
        camp_id: "60d5ec49f1b29e2f64d06a02",
        zone_id: "60d5ec49f1b29e2f64d06a03",
        counter_name: "Counter Main",
        created_by: "60d5ec49f1b29e2f64d06a04",
      };

      vi.spyOn(counterRepositoryMock, "create").mockRejectedValue(new AppError("Duplicate Counter Name", 400));

      await expect(counterUseCase.createCounter(input)).rejects.toThrow(AppError);
    });
  });

  describe("getCounter", () => {
    it("should return counter details if found", async () => {
      const mockCounter = {
        id: "60d5ec49f1b29e2f64d06a05",
        counter_no: "COUNTER-0001",
        counter_name: "Counter Main",
      };

      vi.spyOn(counterRepositoryMock, "findById").mockResolvedValue(mockCounter);

      const result = await counterUseCase.getCounter("60d5ec49f1b29e2f64d06a05");

      expect(counterRepositoryMock.findById).toHaveBeenCalledWith("60d5ec49f1b29e2f64d06a05");
      expect(result).toEqual(mockCounter);
    });

    it("should throw 404 AppError if counter not found", async () => {
      vi.spyOn(counterRepositoryMock, "findById").mockResolvedValue(null);

      await expect(counterUseCase.getCounter("60d5ec49f1b29e2f64d06a05")).rejects.toThrow("Counter not found");
    });
  });

  describe("getAllCounters", () => {
    it("should call findAll with default page/limit if invalid page/limit is provided", async () => {
      const mockResponse = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      vi.spyOn(counterRepositoryMock, "findAll").mockResolvedValue(mockResponse);

      const result = await counterUseCase.getAllCounters(0, -5, {}, "client123");

      expect(counterRepositoryMock.findAll).toHaveBeenCalledWith(1, 10, {}, "client123");
      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteCounter", () => {
    it("should call delete in repository", async () => {
      vi.spyOn(counterRepositoryMock, "delete").mockResolvedValue(undefined);

      await counterUseCase.deleteCounter("counterId", "userId");

      expect(counterRepositoryMock.delete).toHaveBeenCalledWith("counterId", "userId");
    });
  });

  describe("activateCounter/deactivateCounter", () => {
    it("should call updateStatus with Active status", async () => {
      vi.spyOn(counterRepositoryMock, "updateStatus").mockResolvedValue({ id: "counterId", status: "Active" });

      const result = await counterUseCase.activateCounter("counterId", "userId");

      expect(counterRepositoryMock.updateStatus).toHaveBeenCalledWith("counterId", "Active", "userId");
      expect(result.status).toEqual("Active");
    });

    it("should call updateStatus with Inactive status", async () => {
      vi.spyOn(counterRepositoryMock, "updateStatus").mockResolvedValue({ id: "counterId", status: "Inactive" });

      const result = await counterUseCase.deactivateCounter("counterId", "userId");

      expect(counterRepositoryMock.updateStatus).toHaveBeenCalledWith("counterId", "Inactive", "userId");
      expect(result.status).toEqual("Inactive");
    });
  });
});
