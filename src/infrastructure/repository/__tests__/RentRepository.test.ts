import { IRent, IRentModel, Rent, RentStatus } from '../../../domain/Rent'
import { RentRepository } from '../RentRepository'
import { buildPaginate } from '../Paginate'

jest.mock('../../../domain/Rent')

jest.mock('../Paginate', () => ({
    buildPaginate: jest.fn((paginate, query) => query),
}))

describe('RentRepository', () => {
    let rentRepository: RentRepository

    beforeEach(() => {
        jest.clearAllMocks()
        rentRepository = new RentRepository()
    })

    describe('create', () => {
        it('should successfully create a new rent record', async () => {
            const mockRentData = {} as IRent

            const mockRentModel = {
                ...mockRentData,
                _id: '789',
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true,
            } as unknown as IRentModel

            Rent.create = jest.fn().mockResolvedValue(mockRentModel)

            const result = await rentRepository.create(mockRentData)

            expect(Rent.create).toHaveBeenCalledWith(mockRentData)
            expect(result).toEqual(mockRentModel)
        })

        it('should handle errors when creating a new rent record', async () => {
            const mockRentData = {} as IRent

            const error = new Error('Database error')
            Rent.create = jest.fn().mockRejectedValue(error)

            await expect(rentRepository.create(mockRentData)).rejects.toThrow(
                error
            )

            expect(Rent.create).toHaveBeenCalledWith(mockRentData)
        })
    })

    describe('filter', () => {
        it('must filter using mongoose APIs with pagination', async () => {
            const filters = { delivererId: '123' } as Partial<IRent>
            const paginate = { page: 1, perPage: 10 }

            const execMock = jest.fn().mockResolvedValue([])

            Rent.find = jest.fn().mockImplementation(() => ({
                exec: execMock,
            }))

            await rentRepository.filter(filters, paginate)

            expect(buildPaginate).toHaveBeenCalledWith(
                paginate,
                expect.anything()
            )
            expect(Rent.find).toHaveBeenCalledWith(filters)
            expect(execMock).toHaveBeenCalled()
        })

        it('should handle empty filters correctly', async () => {
            const filters = null // Test empty filters
            const paginate = { page: 2, perPage: 5 }

            const execMock = jest.fn().mockResolvedValue([])

            Rent.find = jest.fn().mockImplementation(() => ({
                exec: execMock,
            }))

            await rentRepository.filter(filters, paginate)

            expect(buildPaginate).toHaveBeenCalledWith(
                paginate,
                expect.anything()
            )
            expect(Rent.find).toHaveBeenCalledWith({})
            expect(execMock).toHaveBeenCalled()
        })
    })

    describe('findRentedByPlate', () => {
        it('should find a rented record by plate and delivererId', async () => {
            const mockRentModel = {
                _id: '123',
                deliverer: 'deliverer123',
                motorcycle: {
                    plate: 'XYZ1234',
                },
                status: RentStatus.RENTED,
            } as unknown as IRentModel

            Rent.findOne = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(mockRentModel),
                }),
            })

            const result = await rentRepository.findRentedByPlate(
                'deliverer123',
                'XYZ1234'
            )

            expect(Rent.findOne).toHaveBeenCalledWith({
                deliverer: 'deliverer123',
                status: RentStatus.RENTED,
            })
            expect(result).toEqual(mockRentModel)
        })

        it('should return null when no rent record matches the query', async () => {
            Rent.findOne = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(null),
                }),
            })

            const result = await rentRepository.findRentedByPlate(
                'deliverer999',
                'XYZ9999'
            )

            expect(Rent.findOne).toHaveBeenCalledWith({
                deliverer: 'deliverer999',
                status: RentStatus.RENTED,
            })
            expect(result).toBeNull()
        })
    })
})
