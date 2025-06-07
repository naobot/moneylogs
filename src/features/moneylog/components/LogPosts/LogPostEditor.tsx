import { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
import MDEditor from "@uiw/react-md-editor"

import { Currency } from "@/types/user"
import { useLogPostQuery } from "@/hooks/useLogPostQuery"

import Button from "@/components/Button"

import { CURRENCIES } from "./LogPosts"
import Icon from "@/components/Icon"

const LogPostEditor = ({ type, postId = null, groupId, userId, isCreateNewEntrySet, setCurrentlyEditingPostId, content = '', amount = 0, currency = 'JPY' as Currency, date = Date.now() }: {
  type: 'edit' | 'new'
  postId?: string | null
  groupId: string
  userId: string
  isCreateNewEntrySet: Dispatch<SetStateAction<boolean>>
  setCurrentlyEditingPostId: Dispatch<SetStateAction<string | null>>
  content?: string | null
  amount?: number
  currency?: Currency
  date?: number
}) => {
  const [newEntryContent, newEntryContentSet] = useState<string|null>(content)
  const [newEntryAmount, newEntryAmountSet] = useState<number>(amount)
  const [newEntryDate, newEntryDateSet] = useState<number>(date)
  const [selectedCurrency, selectedCurrencySet] = useState<Currency>(currency)

  const regexMatcher = useMemo(() => {
    switch (selectedCurrency) {
      case 'JPY':
      case 'CNY':
        return /\-?([¥￥])\-?(\d+,)*\d+/g
      case 'USD':
      case 'CAD':
      case 'NTD':
      case 'AUD':
        return /\-?(\$)\-?(\d+,)*\d+/g
      case 'KRW':
        return /\-?(₩)\-?(\d+,)*\d+?/g
      case 'EUR':
        return /\-?(€)\-?(\d+,)*\d+?/g
      case 'GBP':
        return /\-?(£)\-?(\d+,)*\d+?/g
      case 'MYR':
        return /\-?(\d+,)*\d+(?=\w?RM)/g
      default:
        return
    }
  }, [selectedCurrency])

  const { addNewLogPost, editLogPost } = useLogPostQuery()

  const handleSelectCurrency = (e: ChangeEvent<HTMLSelectElement>) => {
    localStorage.setItem('ML__lastCurrency', e.target.value)
    selectedCurrencySet(e.target.value as Currency)
  }

  const handleNewLogPost = async () => {
    if (!selectedCurrency || !newEntryContent) {
      return
    }

    try {
      await addNewLogPost.mutate({
        groupId,
        userId,
        logData: {
          amount: newEntryAmount,
          currency: selectedCurrency,
          content: newEntryContent,
          postDate: newEntryDate,
        }
      })

      isCreateNewEntrySet(false)
      newEntryContentSet(null)
      newEntryAmountSet(0)
    } catch (err) {
      console.error('Failed to create log post:', err)
    }
  }

  const handleEditPost = async () => {
    if (!postId || !selectedCurrency || !newEntryContent) {
      return
    }

    try {
      await editLogPost.mutate({
        postId,
        logData: {
          amount: newEntryAmount,
          currency: selectedCurrency,
          content: newEntryContent,
          postDate: newEntryDate,
        }
      })

      isCreateNewEntrySet(false)
      setCurrentlyEditingPostId(null)
      newEntryContentSet(null)
      newEntryAmountSet(0)
    } catch (err) {
      console.error('Failed to create log post:', err)
    }
  }

  const handleClickCalculator = () => {
    if (newEntryContent && selectedCurrency && regexMatcher) {
      const foundAmounts = newEntryContent.match(regexMatcher)

      console.log(foundAmounts)

      const foundTotal = foundAmounts?.map(x => Number(x.replaceAll(/[¥￥\$₩€£]/g, ''))).reduce((a,b) => a + b)

      console.log(foundTotal)

      if (foundTotal) {
        newEntryAmountSet(foundTotal)
      }
    }
  }

  useEffect(() => {
    const lastCurrency = (localStorage.getItem('ML__lastCurrency') as Currency)
    if (type == 'new' && lastCurrency && CURRENCIES.includes(lastCurrency)) {
      selectedCurrencySet(lastCurrency as Currency)
    }
  }, [])

  return (
    <div className="LogPosts__posts__item LogPosts__posts__item--selected">
      <div
        className="LogPosts__posts__item__header"
      >
        <div
          className="LogPosts__posts__item__header__left"
        >
          <input
            type="datetime-local"
            id="meeting-time"
            name="meeting-time"
            value={dayjs(newEntryDate).format('YYYY-MM-DDTHH:mm')}
            onChange={(e) => newEntryDateSet(dayjs(e?.target?.value, 'YYYY-MM-DDTHH:mm').unix() * 1000)}
          />
        </div>
        <div className="LogPosts__posts__item__header__center LogPosts__posts__item__amount">
          <input
            type="number"
            onChange={(e) => newEntryAmountSet(e?.target?.value)}
            value={newEntryAmount}
            className="LogPostsCurrency__input"
          />
          <select
            name="currency"
            id="newEntry-currency"
            onChange={handleSelectCurrency}
            value={selectedCurrency}
          >
            {CURRENCIES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <Icon
            type={"calculator"}
            onClick={handleClickCalculator}
          />
        </div>
        <div
          className="LogPosts__posts__item__header__right LogPosts__posts__item__comments"
        >
          <Button
            buttonStyle="primary-border-lite"
            size="sm"
            text={'×'}
            aria-label="Close"
            title="Close"
            onClick={type === 'new' ? () => isCreateNewEntrySet(false) : () => setCurrentlyEditingPostId(null)}
          />
        </div>
      </div>
      <div
        className="LogPosts__posts__item__body"
      >
        <div className="LogPosts__posts__item__content container" data-color-mode="light">
          <div className="LogPosts__posts__item__content__editor">
            <MDEditor
              value={newEntryContent ?? ''}
              onChange={newEntryContentSet}
              preview='edit'
            />
            <MDEditor.Markdown source={newEntryContent ?? ''} />
          </div>
        </div>
      </div>
      <div className="LogPosts__posts__item__footer">
        <Button
          buttonStyle="primary-border"
          size="sm"
          text="Submit"
          disabled={!selectedCurrency || !newEntryContent || addNewLogPost?.isLoading}
          onClick={type === 'new' ? handleNewLogPost : handleEditPost}
        />
      </div>
    </div>
  )
}

export default LogPostEditor