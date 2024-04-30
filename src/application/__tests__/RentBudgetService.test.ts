import { RentBudgetService } from '../RentBudgetService'
import { StatusCodes } from 'http-status-codes'
import { DateTime } from 'luxon'
import { IRentRepository } from '../interfaces/IRentRepository'
import { ISimplePaymentCalculationStrategy } from '../interfaces/SimplePaymentCalculationStrategy'
import { CustomError } from '../../utils/handdlers/CustomError'
import { IRentModel } from '../../domain/Rent'

jest.mock('../interfaces/IRentRepository')
jest.mock('../interfaces/SimplePaymentCalculationStrategy')

describe('RentBudgetService', () => {
    let rentBudgetService: RentBudgetService
    let mockRentRepository: jest.Mocked<IRentRepository>
    let mockSimplePaymentCalculationStrategy: jest.Mocked<ISimplePaymentCalculationStrategy>

    beforeEach(() => {
        mockRentRepository = {
            create: jest.fn(),
            filter: jest.fn(),
            findRentedByPlate: jest.fn(),
        }
        mockSimplePaymentCalculationStrategy = {
            calculateCost: jest.fn(),
        }

        rentBudgetService = new RentBudgetService(
            mockRentRepository,
            mockSimplePaymentCalculationStrategy
        )
    })

    describe('expectedReturn', () => {
        it('should throw a "Rent not found" error if no rent record is found', async () => {
            const delivererId = 'del123'
            const plate = 'ABC1234'
            const deliveryDate = new Date('2024-05-01')

            mockRentRepository.findRentedByPlate.mockResolvedValue(null)

            await expect(
                rentBudgetService.expectedReturn(
                    delivererId,
                    plate,
                    deliveryDate
                )
            ).rejects.toThrow(
                new CustomError('Rent not found', StatusCodes.NOT_FOUND)
            )
        })

        it('should calculate and return the total cost, total days used, and rent details', async () => {
            const delivererId = 'del123'
            const plate = 'ABC1234'
            const deliveryDate = new Date('2024-05-01')
            const rent = {} as IRentModel

            const costResult = {
                totalCost: 15000,
                totalDaysUsed: 10,
            }

            mockRentRepository.findRentedByPlate.mockResolvedValue(rent)
            mockSimplePaymentCalculationStrategy.calculateCost.mockReturnValue(
                costResult
            )

            const result = await rentBudgetService.expectedReturn(
                delivererId,
                plate,
                deliveryDate
            )

            expect(mockRentRepository.findRentedByPlate).toHaveBeenCalledWith(
                delivererId,
                plate
            )
            expect(
                mockSimplePaymentCalculationStrategy.calculateCost
            ).toHaveBeenCalledWith(rent, DateTime.fromJSDate(deliveryDate))
            expect(result).toEqual({
                totalCost: costResult.totalCost,
                rent,
                totalDaysUsed: costResult.totalDaysUsed,
            })
        })

        it('should handle any other errors from the repository', async () => {
            const error = new Error('Database error')
            mockRentRepository.findRentedByPlate.mockRejectedValue(error)

            const delivererId = 'del123'
            const plate = 'ABC1234'
            const deliveryDate = new Date('2024-05-01')

            await expect(
                rentBudgetService.expectedReturn(
                    delivererId,
                    plate,
                    deliveryDate
                )
            ).rejects.toThrow(error)
        })
    })
})
