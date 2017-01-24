import { IDAO, IResultSearch } from '../interfaces'
import { APIError } from '../services/api-error'
import { ServiceLib } from '../services/service-lib'
import * as JSData from 'js-data'
import {IBaseUser} from '../interfaces/ibase-user'
import {IBaseModel} from '../interfaces/ibase-model'
import * as _ from 'lodash'

export class DAO<T extends IBaseModel> implements IDAO<T> {
    public collection: JSData.DSResourceDefinition<T>
    public options: JSData.DSFilterArg
    public exclude: Array<string>

    constructor(currentModel: JSData.DSResourceDefinition<T>, joins: any[] = [], exclude: Array<string> = []) {
        if (!currentModel) {
            throw Error('classe não instanciada corretamente')
        }
        this.options = {
            with: joins
        }
        this.exclude = exclude
        this.collection = currentModel
    }

    /**
     * busca todos os registros
     * 
     * @param {Object} [query={}]
     * @param {*} user
     * @returns {JSData.JSDataPromise<Array<T>>}
     * 
     * @memberOf DAO
     */
    public findAll(query: Object = {}, user: IBaseUser): JSData.JSDataPromise<Array<T>> {
        return this.collection.findAll(this.activeRecords(query), this.options)
    }

    /**
     * find register by id
     * 
     * @param {string} id
     * @param {*} user
     * @returns {JSData.JSDataPromise<T>}
     * 
     * @memberOf DAO
     */
    public find(id: string, user: IBaseUser): JSData.JSDataPromise<T> {
        return this.collection.find(id, this.options)
            .then((register: T) => {
                if (register.active) {
                    return register
                } else {
                    throw 'Registro não encontrado'
                }
            })
    }

    /**
     * create registro
     * 
     * @param {T} obj
     * @param {*} user
     * @returns {JSData.JSDataPromise<T>}
     * 
     * @memberOf DAO
     */
    public create(obj: T, user: IBaseUser): JSData.JSDataPromise<T> {
        throw new APIError('Nao implementado', 500)
        // return this.collection.create(obj)
    }

    /**
     * altera registro
     * 
     * @param {string} id
     * @param {T} obj
     * @param {*} user
     * @returns {JSData.JSDataPromise<T>}
     * 
     * @memberOf DAO
     */
    public update(id: string, user: IBaseUser, obj: T): JSData.JSDataPromise<T> {
        if (!ServiceLib.validateFields(obj, Object.keys(obj), this.exclude)) {
            throw 'Alguns dados são obrigatórios, corrija-os e tente novamente'
        }
        return this.collection.update(id, obj)
    }

    /**
     * delete registro
     * 
     * @param {string} id
     * @param {*} user
     * @returns {JSData.JSDataPromise<boolean>}
     * 
     * @memberOf DAO
     */
    public delete(id: string, user: IBaseUser): JSData.JSDataPromise<boolean> {
        // return this.collection.destroy(id)
        //     .then(() => true)
        //     .catch(() => false)

        return this.collection.find(id)
            .then((register: T) => {
                if (_.isEmpty(register)) {
                    throw 'Registro não encontrado'
                }
                let newObj: T = register
                newObj.active = false
                return this.collection.update(id,newObj).then(() => true)
            })
    }

    /**
     * realize search query using limits and page control
     * 
     * @param {Object} search
     * @param {*} user
     * @param {number} [page]
     * @param {number} [limit]
     * @param {Array<string>} [order]
     * @returns {JSData.JSDataPromise<IResultSearch<T>>}
     * 
     * @memberOf DAO
     */
    paginatedQuery(
        search: Object, user: IBaseUser, page?: number, limit?: number, order?: Array<string>
    ): JSData.JSDataPromise<IResultSearch<T>> {
        search = this.activeRecords(search)
        let _page: number = page || 1
        let _limit: number = limit || 10
        let _order: string[] = []
        let params = Object.assign({}, search, {
            orderBy: _order,
            offset: _limit * (_page - 1),
            limit: _limit
        })

        return this.collection.findAll(search)
            .then((countResult) => {
                return this.collection.findAll(params)
                    .then((results) => {
                        return {
                            page : _page,
                            total: countResult.length,
                            result: results
                        } as IResultSearch<T>
                    })
            })
    }

    /**
     * Faz um merge com uma possível pesquisa para buscar somente dados ativos
     * 
     * @param {Object} [query={}]
     * @returns {*}
     * 
     * @memberOf DAO
     */
    private activeRecords(query: Object = {}): any {
        return _.merge(query, { where: { active: { '===': true } } })
    }
}
