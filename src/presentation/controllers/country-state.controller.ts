import type { Response } from "express";
import type { CountryStateService } from "../../domain/repositories/country-state.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { CountryStateValidator } from "../../application/validators/country-state.validator.js";
import { logger } from "../../shared/logger/logger.js";

export class CountryStateController {
  constructor(private countryStateUseCase: CountryStateService) {}

  createCountryState = async (req: AuthenticatedRequest, res: Response) => {
    CountryStateValidator.validateCreateCountryState(req.body);

    logger.info(`Creating country state: ${req.body.country_state_name}`);
    const countryState = await this.countryStateUseCase.createCountryState(req.body);
    res.status(201).json({ message: "Country State created successfully", countryState });
  };

  getCountryState = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching country state: ${id}`);
    const countryState = await this.countryStateUseCase.getCountryState(id as string);
    res.status(200).json(countryState);
  };

  getCountryStates = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Fetching all country states");
    const nationalityName = req.query.nationality_name as string | undefined;
    const filter = nationalityName ? { nationality_name: nationalityName } : undefined;
    
    const countryStates = await this.countryStateUseCase.getAllCountryStates(filter);
    res.status(200).json(countryStates);
  };

  updateCountryState = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    CountryStateValidator.validateUpdateCountryState(req.body);

    logger.info(`Updating country state: ${id}`);
    const countryState = await this.countryStateUseCase.updateCountryState(id as string, req.body);
    res.status(200).json({ message: "Country State updated successfully", countryState });
  };

  deleteCountryState = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Deleting country state: ${id}`);
    await this.countryStateUseCase.deleteCountryState(id as string);
    res.status(200).json({ message: "Country State deleted successfully" });
  };
}
